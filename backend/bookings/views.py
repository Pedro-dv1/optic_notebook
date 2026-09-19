from datetime import datetime

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from companies.models import Company
from platform_core.permissions import IsActiveCompanyAdmin, IsCustomer, company_for_user
from platform_core.throttles import WindowScopedRateThrottle
from platform_core.search import accent_insensitive_query
from professionals.models import Professional, WorkSchedule
from services.models import Service

from .models import Appointment
from .operations import (
    ACTIVE_APPOINTMENT_STATUSES,
    cancel_appointment,
    create_appointment,
    find_managed_appointment,
    reschedule_appointment,
)
from .serializers import (
    AppointmentCreateSerializer,
    AppointmentSerializer,
    AvailabilityQuerySerializer,
    CustomerRescheduleSerializer,
    CompanyCustomerSerializer,
    ManagementTokenSerializer,
    RescheduleSerializer,
)


class CompanyCustomerListView(generics.ListAPIView):
    permission_classes = (IsActiveCompanyAdmin,)
    serializer_class = CompanyCustomerSerializer

    def get_queryset(self):
        queryset = Appointment.objects.filter(company=company_for_user(self.request.user)).select_related("customer")
        if query := self.request.query_params.get("q", "").strip():
            if len(query) > 150:
                raise ValidationError({"q": "A pesquisa deve ter no máximo 150 caracteres."})
            queryset = queryset.filter(accent_insensitive_query(
                query, "customer_name", "customer_email", "customer_whatsapp"
            ))
        return queryset.order_by("customer_email", "-starts_at").distinct("customer_email")


class CompanyAppointmentPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 200


class AvailabilityView(generics.GenericAPIView):
    permission_classes = (AllowAny,)
    serializer_class = AvailabilityQuerySerializer
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "availability"

    def get(self, request, slug):
        query = self.get_serializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        company = get_object_or_404(
            Company.objects.select_related("booking_settings"),
            slug=slug,
            status=Company.Status.ACTIVE,
        )
        service = get_object_or_404(Service, pk=query.validated_data["service"], company=company, is_active=True)
        professionals = Professional.objects.filter(company=company, is_active=True, services=service)
        if professional_id := query.validated_data.get("professional"):
            professionals = professionals.filter(pk=professional_id)

        target_date = query.validated_data["date"]
        schedules = WorkSchedule.objects.filter(
            professional__in=professionals,
            weekday=target_date.weekday(),
        ).select_related("professional")
        occupied = Appointment.objects.filter(
            company=company,
            professional__in=professionals,
            status__in=ACTIVE_APPOINTMENT_STATUSES,
            starts_at__date=target_date,
        ).values("professional_id", "starts_at", "ends_at")
        occupied_by_professional = {}
        for appointment in occupied:
            occupied_by_professional.setdefault(appointment["professional_id"], []).append(
                (appointment["starts_at"], appointment["ends_at"])
            )

        slots = []
        interval = service.slot_interval
        now = timezone.now()
        for schedule in schedules:
            cursor = timezone.make_aware(datetime.combine(target_date, schedule.starts_at))
            schedule_end = timezone.make_aware(datetime.combine(target_date, schedule.ends_at))
            while cursor + service.duration <= schedule_end:
                ends_at = cursor + service.duration
                conflicts = any(
                    existing_start < ends_at and existing_end > cursor
                    for existing_start, existing_end in occupied_by_professional.get(schedule.professional_id, ())
                )
                if cursor > now and not conflicts:
                    slots.append(
                        {
                            "professional": schedule.professional_id,
                            "professional_name": schedule.professional.name,
                            "starts_at": cursor,
                            "ends_at": ends_at,
                        }
                    )
                cursor += interval
        slots.sort(key=lambda item: (item["starts_at"], str(item["professional"])))
        return Response(slots)


class PublicAppointmentCreateView(generics.GenericAPIView):
    permission_classes = (AllowAny,)
    serializer_class = AppointmentCreateSerializer
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "booking"

    def post(self, request, slug):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = get_object_or_404(
            Company.objects.select_related("booking_settings"),
            slug=slug,
            status=Company.Status.ACTIVE,
        )
        customer = request.user if request.user.is_authenticated else None
        with transaction.atomic():
            appointment, management_token = create_appointment(
                company=company,
                service_id=serializer.validated_data["service"],
                professional_id=serializer.validated_data["professional"],
                starts_at=serializer.validated_data["starts_at"],
                customer=customer,
                customer_data=serializer.customer_snapshot(request.user),
            )
        data = AppointmentSerializer(appointment).data
        data["management_token"] = management_token
        return Response(data, status=status.HTTP_201_CREATED)


class PublicAppointmentCancelView(generics.GenericAPIView):
    permission_classes = (AllowAny,)
    serializer_class = ManagementTokenSerializer
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "public_change"

    def post(self, request, slug):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = get_object_or_404(Company, slug=slug, status=Company.Status.ACTIVE)
        with transaction.atomic():
            appointment = find_managed_appointment(
                company=company,
                secret=serializer.validated_data["management_token"],
                lock=True,
            )
            cancel_appointment(appointment)
        return Response(AppointmentSerializer(appointment).data)


class PublicAppointmentRescheduleView(generics.GenericAPIView):
    permission_classes = (AllowAny,)
    serializer_class = RescheduleSerializer
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "public_change"

    def post(self, request, slug):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = get_object_or_404(Company, slug=slug, status=Company.Status.ACTIVE)
        with transaction.atomic():
            appointment = find_managed_appointment(
                company=company,
                secret=serializer.validated_data["management_token"],
                lock=True,
            )
            reschedule_appointment(appointment, serializer.validated_data["starts_at"])
        return Response(AppointmentSerializer(appointment).data)


class CompanyAppointmentViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (IsActiveCompanyAdmin,)
    serializer_class = AppointmentSerializer
    pagination_class = CompanyAppointmentPagination

    def get_queryset(self):
        queryset = Appointment.objects.filter(company=company_for_user(self.request.user)).select_related(
            "company__booking_settings", "service", "professional", "customer"
        )
        params = self.request.query_params
        if value := params.get("status"):
            if value not in Appointment.Status.values:
                raise ValidationError({"status": "Status de agendamento inválido."})
            queryset = queryset.filter(status=value)
        for field in ("professional", "service"):
            if value := params.get(field):
                try:
                    queryset = queryset.filter(**{f"{field}_id": value})
                except (ValueError, TypeError):
                    raise ValidationError({field: "Identificador inválido."})
        if value := params.get("date"):
            date_field = serializers.DateField()
            try:
                parsed_date = date_field.to_internal_value(value)
            except serializers.ValidationError:
                raise ValidationError({"date": "Use uma data no formato AAAA-MM-DD."})
            queryset = queryset.filter(starts_at__date=parsed_date)
        for parameter, lookup in (("date_from", "starts_at__date__gte"), ("date_to", "starts_at__date__lte")):
            if value := params.get(parameter):
                try:
                    parsed_date = serializers.DateField().to_internal_value(value)
                except serializers.ValidationError:
                    raise ValidationError({parameter: "Use uma data no formato AAAA-MM-DD."})
                queryset = queryset.filter(**{lookup: parsed_date})
        if query := params.get("q", "").strip():
            if len(query) > 150:
                raise ValidationError({"q": "A pesquisa deve ter no máximo 150 caracteres."})
            queryset = queryset.filter(accent_insensitive_query(
                query, "customer_name", "customer_email", "customer_whatsapp",
                "service__name", "professional__name",
            ))
        return queryset

    @action(detail=True, methods=("post",))
    def confirm(self, request, pk=None):
        appointment = self.get_object()
        if appointment.status != Appointment.Status.WAITING_CONFIRMATION:
            from rest_framework.exceptions import ValidationError

            raise ValidationError("Somente agendamentos aguardando confirmação podem ser confirmados.")
        appointment.status = Appointment.Status.CONFIRMED
        appointment.save(update_fields=("status", "updated_at"))
        return Response(self.get_serializer(appointment).data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        appointment = self.get_object()
        if appointment.status == Appointment.Status.CANCELLED:
            from rest_framework.exceptions import ValidationError

            raise ValidationError("O agendamento já está cancelado.")
        appointment.status = Appointment.Status.CANCELLED
        appointment.save(update_fields=("status", "updated_at"))
        return Response(self.get_serializer(appointment).data)


class CustomerAppointmentViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (IsCustomer,)
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        return Appointment.objects.filter(customer=self.request.user).select_related(
            "company__booking_settings", "service", "professional", "customer"
        )

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        with transaction.atomic():
            appointment = self.get_queryset().select_for_update(of=("self",)).filter(pk=pk).first()
            if not appointment:
                from rest_framework.exceptions import NotFound

                raise NotFound()
            cancel_appointment(appointment)
        return Response(self.get_serializer(appointment).data)

    @action(detail=True, methods=("post",), serializer_class=CustomerRescheduleSerializer)
    def reschedule(self, request, pk=None):
        serializer = CustomerRescheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            appointment = self.get_queryset().select_for_update(of=("self",)).filter(pk=pk).first()
            if not appointment:
                from rest_framework.exceptions import NotFound

                raise NotFound()
            reschedule_appointment(appointment, serializer.validated_data["starts_at"])
        return Response(AppointmentSerializer(appointment).data)
