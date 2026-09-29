from datetime import datetime, time, timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from accounts.models import User

from companies.models import Company, CompanyUnit
from professionals.models import Professional, ProfessionalUnavailability, WorkSchedule
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


def resolve_company_unit(company, unit_id=None):
    # ASVS 8.2.2/8.4.1: never resolve a caller-supplied unit outside this company.
    units = CompanyUnit.objects.filter(company=company, is_active=True)
    if unit_id:
        return get_object_or_404(units, pk=unit_id)
    available = list(units[:2])
    if len(available) != 1:
        raise serializers.ValidationError({"unit": "Selecione uma unidade ativa da empresa."})
    return available[0]


def validate_unit_catalog(unit, service, professional):
    if unit.company_id != service.company_id or unit.company_id != professional.company_id:
        raise serializers.ValidationError({"unit": "Selecione recursos desta empresa."})
    if not unit.is_active or not service.units.filter(pk=unit.pk).exists():
        raise serializers.ValidationError({"unit": "O serviço não é oferecido nesta unidade."})
    if not professional.units.filter(pk=unit.pk).exists():
        raise serializers.ValidationError({"unit": "O profissional não atende nesta unidade."})


def available_slots(*, company, service, unit, date_from, date_to, professional_id=None, first_per_day=False):
    if unit.company_id != company.pk or service.company_id != company.pk or not unit.is_active or not service.units.filter(pk=unit.pk).exists():
        raise serializers.ValidationError({"unit": "O serviço não é oferecido nesta unidade."})
    professionals = Professional.objects.filter(company=company, is_active=True, services=service, units=unit)
    if professional_id:
        professional = get_object_or_404(professionals, pk=professional_id)
        professionals = professionals.filter(pk=professional.pk)
    schedules = list(WorkSchedule.objects.filter(professional__in=professionals, unit=unit).select_related("professional"))
    period_start = timezone.make_aware(datetime.combine(date_from, time.min))
    period_end = timezone.make_aware(datetime.combine(date_to + timedelta(days=1), time.min))
    occupied = Appointment.objects.filter(
        professional__in=professionals, status__in=ACTIVE_APPOINTMENT_STATUSES,
        starts_at__lt=period_end, ends_at__gt=period_start,
    ).values("professional_id", "starts_at", "ends_at")
    blocked = ProfessionalUnavailability.objects.filter(
        company=company, professional__in=professionals,
        starts_at__lt=period_end, ends_at__gt=period_start,
    ).values("professional_id", "starts_at", "ends_at")
    occupied_by_professional = {}
    for period in list(occupied) + list(blocked):
        occupied_by_professional.setdefault(period["professional_id"], []).append((period["starts_at"], period["ends_at"]))
    now = timezone.now()
    result = {}
    for offset in range((date_to - date_from).days + 1):
        date = date_from + timedelta(days=offset)
        slots = []
        for schedule in schedules:
            if schedule.weekday != date.weekday():
                continue
            cursor = timezone.make_aware(datetime.combine(date, schedule.starts_at))
            end = timezone.make_aware(datetime.combine(date, schedule.ends_at))
            while cursor + service.duration <= end:
                slot_end = cursor + service.duration
                conflicts = any(start < slot_end and stop > cursor for start, stop in occupied_by_professional.get(schedule.professional_id, ()))
                if cursor > now and not conflicts:
                    slots.append({"professional": schedule.professional_id, "professional_name": schedule.professional.name, "starts_at": cursor, "ends_at": slot_end})
                    if first_per_day:
                        break
                cursor += service.slot_interval
            if first_per_day and slots:
                break
        slots.sort(key=lambda slot: (slot["starts_at"], str(slot["professional"])))
        result[date.isoformat()] = slots
    return result


def _covered_schedule(professional, starts_at, ends_at, unit):
    local_start = timezone.localtime(starts_at)
    local_end = timezone.localtime(ends_at)
    if local_start.date() != local_end.date():
        return None
    schedules = WorkSchedule.objects.filter(
        professional=professional,
        unit=unit,
        weekday=local_start.weekday(),
        starts_at__lte=local_start.time().replace(tzinfo=None),
        ends_at__gte=local_end.time().replace(tzinfo=None),
    )
    return schedules.first()


def _validate_slot(company, service, professional, starts_at, unit, exclude_appointment=None):
    if company.status != Company.Status.ACTIVE:
        raise serializers.ValidationError("Esta conta está suspensa.")
    if service.company_id != company.id or not service.is_active:
        raise serializers.ValidationError("O serviço não está disponível.")
    if professional.company_id != company.id or not professional.is_active:
        raise serializers.ValidationError("O profissional não está disponível.")
    if not professional.services.filter(pk=service.pk, is_active=True).exists():
        raise serializers.ValidationError("O profissional não realiza este serviço.")
    validate_unit_catalog(unit, service, professional)
    if starts_at <= timezone.now():
        raise serializers.ValidationError("O agendamento deve ser feito para uma data futura.")

    ends_at = starts_at + service.duration
    schedule = _covered_schedule(professional, starts_at, ends_at, unit)
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
    if ProfessionalUnavailability.objects.filter(
        company=company,
        professional=professional,
        starts_at__lt=ends_at,
        ends_at__gt=starts_at,
    ).exists():
        raise BookingConflict("O profissional está indisponível neste período.")
    return ends_at


def create_appointment(
    *, company, service_id, professional_id, starts_at, customer, customer_data,
    origin=Appointment.Origin.CUSTOMER,
    unit_id=None,
):
    try:
        with transaction.atomic():
            if customer:
                # Coordinate with permanent deletion before retaining any customer snapshot.
                customer = get_object_or_404(User.objects.select_for_update(no_key=True), pk=customer.pk, is_active=True)
            # ponytail: company lock serializes catalog changes; narrow to unit locks if write throughput requires it.
            # Non-key locks permit FK inserts while another writer holds the professional lock.
            company = Company.objects.select_for_update(no_key=True).get(pk=company.pk)
            unit = resolve_company_unit(company, unit_id)
            service = get_object_or_404(Service, pk=service_id, company=company)
            professional = get_object_or_404(
                Professional.objects.select_for_update(),
                pk=professional_id,
                company=company,
            )
            ends_at = _validate_slot(company, service, professional, starts_at, unit)
            appointment = Appointment.objects.create(
                company=company,
                unit=unit,
                service=service,
                professional=professional,
                starts_at=starts_at,
                ends_at=ends_at,
                customer=customer,
                origin=origin,
                status=Appointment.Status.CONFIRMED if origin != Appointment.Origin.CUSTOMER else Appointment.Status.WAITING_CONFIRMATION,
                **customer_data,
            )
            management_secret = AppointmentManagementCredential.issue(appointment)
            from .models import NotificationEvent

            NotificationEvent.objects.get_or_create(
                appointment=appointment,
                kind=NotificationEvent.Kind.BOOKING_REMINDER,
                scheduled_for=max(timezone.now(), starts_at - timedelta(hours=24)),
            )
            return appointment, management_secret
    except IntegrityError as exc:
        raise BookingConflict() from exc


def _validate_change_deadline(appointment):
    if appointment.outcome:
        raise serializers.ValidationError("Um atendimento concluído não pode ser alterado.")
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
        "appointment__unit",
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
    from .models import NotificationEvent

    NotificationEvent.objects.get_or_create(
        appointment=appointment,
        kind=NotificationEvent.Kind.BOOKING_CANCELLED,
        scheduled_for=timezone.now(),
    )
    return appointment


def reschedule_appointment(appointment, starts_at):
    _validate_change_deadline(appointment)
    try:
        Company.objects.select_for_update(no_key=True).get(pk=appointment.company_id)
        unit = resolve_company_unit(appointment.company, appointment.unit_id)
        professional = Professional.objects.select_for_update().get(pk=appointment.professional_id)
        ends_at = _validate_slot(
            appointment.company,
            appointment.service,
            professional,
            starts_at,
            unit,
            exclude_appointment=appointment,
        )
        appointment.starts_at = starts_at
        appointment.ends_at = ends_at
        appointment.unit = unit
        appointment.save(update_fields=("starts_at", "ends_at", "unit", "updated_at"))
        from .models import NotificationEvent

        NotificationEvent.objects.filter(
            appointment=appointment,
            kind=NotificationEvent.Kind.BOOKING_REMINDER,
            state=NotificationEvent.State.PENDING,
        ).delete()
        NotificationEvent.objects.create(
            appointment=appointment,
            kind=NotificationEvent.Kind.BOOKING_REMINDER,
            scheduled_for=max(timezone.now(), starts_at - timedelta(hours=24)),
        )
        NotificationEvent.objects.get_or_create(
            appointment=appointment,
            kind=NotificationEvent.Kind.BOOKING_RESCHEDULED,
            scheduled_for=timezone.now(),
        )
        return appointment
    except IntegrityError as exc:
        raise BookingConflict() from exc


@transaction.atomic
def record_outcome(appointment, *, outcome, actor):
    from .models import AppointmentOutcomeEvent, NotificationEvent, ReviewCredential

    if appointment.status != Appointment.Status.CONFIRMED:
        raise serializers.ValidationError("Somente agendamentos confirmados podem receber resultado.")
    if appointment.ends_at > timezone.now():
        raise serializers.ValidationError("O resultado só pode ser registrado após o horário do atendimento.")
    if outcome not in Appointment.Outcome.values:
        raise serializers.ValidationError({"outcome": "Resultado inválido."})
    if appointment.outcome == outcome:
        raise serializers.ValidationError("Este resultado já está registrado.")
    if outcome == Appointment.Outcome.NO_SHOW and hasattr(appointment, "review"):
        raise serializers.ValidationError("Um atendimento já avaliado não pode ser marcado como falta.")

    now = timezone.now()
    appointment.outcome = outcome
    appointment.outcome_recorded_at = now
    appointment.outcome_recorded_by = actor
    appointment.save(update_fields=("outcome", "outcome_recorded_at", "outcome_recorded_by", "updated_at"))
    AppointmentOutcomeEvent.objects.create(appointment=appointment, outcome=outcome, actor=actor)
    if outcome == Appointment.Outcome.COMPLETED:
        NotificationEvent.objects.get_or_create(
            appointment=appointment,
            kind=NotificationEvent.Kind.REVIEW_REQUEST,
            scheduled_for=now,
        )
    else:
        NotificationEvent.objects.filter(
            appointment=appointment,
            kind=NotificationEvent.Kind.REVIEW_REQUEST,
            state=NotificationEvent.State.PENDING,
        ).delete()
        ReviewCredential.objects.filter(appointment=appointment, consumed_at__isnull=True).delete()
    return appointment
