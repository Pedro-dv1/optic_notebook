from datetime import datetime

from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound

from companies.models import Company
from professionals.models import Professional, WorkSchedule
from services.models import Service

from .models import Appointment, AppointmentManagementCredential

ACTIVE_APPOINTMENT_STATUSES = (
    Appointment.Status.WAITING_CONFIRMATION,
    Appointment.Status.CONFIRMED,
)


class BookingConflict(serializers.ValidationError):
    status_code = 409
    default_detail = "Este horário não está mais disponível. Escolha outro horário."
    default_code = "booking_conflict"


def _covered_schedule(professional, starts_at, ends_at):
    local_start = timezone.localtime(starts_at)
    local_end = timezone.localtime(ends_at)
    if local_start.date() != local_end.date():
        return None
    schedules = WorkSchedule.objects.filter(
        professional=professional,
        weekday=local_start.weekday(),
        starts_at__lte=local_start.time().replace(tzinfo=None),
        ends_at__gte=local_end.time().replace(tzinfo=None),
    )
    return schedules.first()


def _validate_slot(company, service, professional, starts_at, exclude_appointment=None):
    if company.status != Company.Status.ACTIVE:
        raise serializers.ValidationError("Esta conta está suspensa.")
    if service.company_id != company.id or not service.is_active:
        raise serializers.ValidationError("O serviço não está disponível.")
    if professional.company_id != company.id or not professional.is_active:
        raise serializers.ValidationError("O profissional não está disponível.")
    if not professional.services.filter(pk=service.pk, is_active=True).exists():
        raise serializers.ValidationError("O profissional não realiza este serviço.")
    if starts_at <= timezone.now():
        raise serializers.ValidationError("O agendamento deve ser feito para uma data futura.")

    ends_at = starts_at + service.duration
    schedule = _covered_schedule(professional, starts_at, ends_at)
    if schedule is None:
        raise serializers.ValidationError("O horário está fora da jornada do profissional.")

    local_start = timezone.localtime(starts_at)
    schedule_start = timezone.make_aware(datetime.combine(local_start.date(), schedule.starts_at))
    elapsed = (local_start - schedule_start).total_seconds()
    interval = service.slot_interval.total_seconds()
    if elapsed % interval:
        raise serializers.ValidationError("O horário não corresponde aos intervalos disponíveis do serviço.")

    overlaps = Appointment.objects.filter(
        professional=professional,
        status__in=ACTIVE_APPOINTMENT_STATUSES,
        starts_at__lt=ends_at,
        ends_at__gt=starts_at,
    )
    if exclude_appointment:
        overlaps = overlaps.exclude(pk=exclude_appointment.pk)
    if overlaps.exists():
        raise BookingConflict()
    return ends_at


def create_appointment(*, company, service_id, professional_id, starts_at, customer, customer_data):
    try:
        with transaction.atomic():
            service = get_object_or_404(Service, pk=service_id, company=company)
            professional = get_object_or_404(
                Professional.objects.select_for_update(),
                pk=professional_id,
                company=company,
            )
            ends_at = _validate_slot(company, service, professional, starts_at)
            appointment = Appointment.objects.create(
                company=company,
                service=service,
                professional=professional,
                starts_at=starts_at,
                ends_at=ends_at,
                customer=customer,
                **customer_data,
            )
            management_secret = AppointmentManagementCredential.issue(appointment)
            return appointment, management_secret
    except IntegrityError as exc:
        raise BookingConflict() from exc


def _validate_change_deadline(appointment):
    deadline = appointment.starts_at - appointment.company.booking_settings.minimum_change_notice
    if timezone.now() > deadline:
        raise serializers.ValidationError("O prazo para cancelar ou reagendar já terminou.")
    if appointment.status not in ACTIVE_APPOINTMENT_STATUSES:
        raise serializers.ValidationError("Este agendamento não pode mais ser alterado.")


def find_managed_appointment(*, company, secret, lock=False):
    digest = AppointmentManagementCredential.digest_secret(secret)
    queryset = AppointmentManagementCredential.objects.select_related(
        "appointment__company__booking_settings",
        "appointment__service",
        "appointment__professional",
    )
    if lock:
        queryset = queryset.select_for_update(of=("self", "appointment"))
    credential = queryset.filter(digest=digest, appointment__company=company).first()
    if not credential:
        raise NotFound("Agendamento não encontrado.")
    return credential.appointment


def cancel_appointment(appointment):
    _validate_change_deadline(appointment)
    appointment.status = Appointment.Status.CANCELLED
    appointment.save(update_fields=("status", "updated_at"))
    return appointment


def reschedule_appointment(appointment, starts_at):
    _validate_change_deadline(appointment)
    try:
        professional = Professional.objects.select_for_update().get(pk=appointment.professional_id)
        ends_at = _validate_slot(
            appointment.company,
            appointment.service,
            professional,
            starts_at,
            exclude_appointment=appointment,
        )
        appointment.starts_at = starts_at
        appointment.ends_at = ends_at
        appointment.save(update_fields=("starts_at", "ends_at", "updated_at"))
        return appointment
    except IntegrityError as exc:
        raise BookingConflict() from exc
