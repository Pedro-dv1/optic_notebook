import logging
from datetime import datetime, time, timedelta

from django.db import IntegrityError, transaction
from django.db.models import Count, Max, Q, Value, Window, F
from django.db.models.functions import Coalesce, ExtractHour, ExtractWeekDay, Lower, NullIf, Trim, TruncDate, RowNumber
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from accounts.models import User
from companies.models import Company
from platform_core.permissions import (
    IsActiveCompanyAdmin, IsActiveProfessional, IsCustomer, company_for_user, professional_for_user,
)
from platform_core.throttles import WindowScopedRateThrottle
from platform_core.search import accent_insensitive_query
from professionals.models import Professional, ProfessionalUnavailability, WorkSchedule
from services.models import Service

from .models import (
    Appointment, AppointmentManagementCredential, BookingPushSubscription, NotificationEvent,
    PushSubscription, Review, ReviewCredential,
)
from .operations import (
    ACTIVE_APPOINTMENT_STATUSES,
    cancel_appointment,
    create_appointment,
    find_managed_appointment,
    record_outcome,
    resolve_company_unit,
    available_slots,
    reschedule_appointment,
)
from .serializers import (
    AppointmentCreateSerializer,
    AppointmentSerializer,
    AppointmentOutcomeSerializer,
    AppointmentPeriodSerializer,
    AvailabilityQuerySerializer,
    AvailabilityDaysQuerySerializer,
    CustomerRescheduleSerializer,
    CompanyCustomerSerializer,
    ManagementTokenSerializer,
    ManualAppointmentCreateSerializer,
    PushSubscriptionSerializer,
    ReviewCreateSerializer,
    ReviewResponseSerializer,
    ReviewSerializer,
    RescheduleSerializer,
    UnitQuerySerializer,
)

security_logger = logging.getLogger("optic_notebook.security")
from .expiration import expire_pending_appointments


def recurring_customers(appointments):
    registered = appointments.filter(customer__isnull=False).values(
        "customer_id", "customer__full_name", "customer__email"
    ).annotate(total=Count("id")).filter(total__gt=1).order_by("-total")[:10]
    guests = (
        appointments.filter(customer__isnull=True)
        .annotate(contact=Coalesce(NullIf(Lower(Trim("customer_email")), Value("")), Trim("customer_whatsapp")))
        .values("contact")
        .annotate(total=Count("id"), display_name=Max("customer_name"))
        .filter(total__gt=1)
        .exclude(contact="")
        .order_by("-total")[:10]
    )
    rows = [
        {"customer_id": str(row["customer_id"]), "customer_name": row["customer__full_name"],
         "customer_email": row["customer__email"], "total": row["total"]}
        for row in registered
    ]
    rows.extend(
        {"customer_id": None, "customer_name": row["display_name"],
         "customer_email": row["contact"], "total": row["total"]}
        for row in guests
    )
    return sorted(rows, key=lambda row: (-row["total"], row["customer_name"]))[:10]


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
        unit = resolve_company_unit(company, query.validated_data.get("unit"))
        target_date = query.validated_data["date"]
        slots = available_slots(
            company=company, service=service, unit=unit,
            date_from=target_date, date_to=target_date,
            professional_id=query.validated_data.get("professional"),
        )
        return Response(slots[target_date.isoformat()])


class AvailabilityDaysView(AvailabilityView):
    serializer_class = AvailabilityDaysQuerySerializer

    def get(self, request, slug):
        query = self.get_serializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        values = query.validated_data
        company = get_object_or_404(Company, slug=slug, status=Company.Status.ACTIVE)
        service = get_object_or_404(Service, pk=values["service"], company=company, is_active=True)
        unit = resolve_company_unit(company, values.get("unit"))
        days = available_slots(
            company=company, service=service, unit=unit,
            date_from=values["start_date"], date_to=values["end_date"],
            professional_id=values.get("professional"), first_per_day=True,
        )
        return Response({"available_dates": [date for date, slots in days.items() if slots]})


class PublicAppointmentCreateView(generics.GenericAPIView):
    permission_classes = (AllowAny,)
    serializer_class = AppointmentCreateSerializer
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "booking"

    def post(self, request, slug):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if request.user.is_authenticated and (company_for_user(request.user) or professional_for_user(request.user)):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Use o painel correspondente à sua conta.")
        company = get_object_or_404(
            Company.objects.select_related("booking_settings"),
            slug=slug,
            status=Company.Status.ACTIVE,
        )
        customer = request.user if request.user.is_authenticated else None
        with transaction.atomic():
            appointment, management_token = create_appointment(
                company=company,
                unit_id=serializer.validated_data.get("unit"),
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

    @action(detail=False, methods=("post",), serializer_class=ManualAppointmentCreateSerializer)
    def manual(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = company_for_user(request.user)
        customer_data = serializer.customer_snapshot()
        customer = (Appointment.objects.filter(
            company=company, customer__isnull=False,
            customer__email__iexact=customer_data["customer_email"],
            customer__whatsapp=customer_data["customer_whatsapp"],
        ).values_list("customer_id", flat=True).first())
        appointment, _ = create_appointment(
            company=company,
            unit_id=serializer.validated_data.get("unit"),
            service_id=serializer.validated_data["service"],
            professional_id=serializer.validated_data["professional"],
            starts_at=serializer.validated_data["starts_at"],
            customer=User.objects.filter(pk=customer).first() if customer else None,
            customer_data=customer_data,
            origin=Appointment.Origin.ADMIN,
        )
        security_logger.info("manual_appointment_created appointment_id=%s actor_id=%s", appointment.id, request.user.id)
        return Response(AppointmentSerializer(appointment, context={"request": request}).data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        expire_pending_appointments(company=company_for_user(self.request.user))
        queryset = Appointment.objects.filter(company=company_for_user(self.request.user)).select_related(
            "company__booking_settings", "service", "professional", "customer", "review", "unit"
        )
        params = self.request.query_params
        if value := params.get("status"):
            if value in Appointment.Outcome.values:
                queryset = queryset.filter(outcome=value)
            elif value == Appointment.Status.CONFIRMED:
                queryset = queryset.filter(status=value, outcome__isnull=True)
            elif value in Appointment.Status.values:
                queryset = queryset.filter(status=value)
            else:
                raise ValidationError({"status": "Status de agendamento inválido."})
        unit_query = UnitQuerySerializer(data=params)
        unit_query.is_valid(raise_exception=True)
        if unit_id := unit_query.validated_data.get("unit"):
            queryset = queryset.filter(unit=resolve_company_unit(company_for_user(self.request.user), unit_id))
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

    @transaction.atomic
    @action(detail=True, methods=("post",))
    def confirm(self, request, pk=None):
        appointment = get_object_or_404(self.get_queryset().select_for_update(of=("self",)), pk=pk)
        if appointment.starts_at <= timezone.now() and appointment.status == Appointment.Status.WAITING_CONFIRMATION:
            expire_pending_appointments(company=appointment.company, appointment=appointment, limit=1)
            appointment.refresh_from_db()
        if appointment.status != Appointment.Status.WAITING_CONFIRMATION:
            return Response({"errors": {"detail": "Somente solicitações futuras aguardando confirmação podem ser confirmadas."}}, status=status.HTTP_400_BAD_REQUEST)
        appointment.status = Appointment.Status.CONFIRMED
        appointment.save(update_fields=("status", "updated_at"))
        NotificationEvent.objects.get_or_create(
            appointment=appointment,
            kind=NotificationEvent.Kind.BOOKING_CONFIRMED,
            scheduled_for=timezone.now(),
        )
        return Response(self.get_serializer(appointment).data)

    @action(detail=True, methods=("post",))
    def cancel(self, request, pk=None):
        appointment = self.get_object()
        if appointment.status == Appointment.Status.CANCELLED:
            from rest_framework.exceptions import ValidationError

            raise ValidationError("O agendamento já está cancelado.")
        if appointment.outcome:
            raise ValidationError("Um atendimento com resultado registrado não pode ser cancelado.")
        appointment.status = Appointment.Status.CANCELLED
        appointment.save(update_fields=("status", "updated_at"))
        NotificationEvent.objects.get_or_create(
            appointment=appointment,
            kind=NotificationEvent.Kind.BOOKING_CANCELLED,
            scheduled_for=timezone.now(),
        )
        return Response(self.get_serializer(appointment).data)

    @action(detail=True, methods=("post",), serializer_class=AppointmentOutcomeSerializer)
    def outcome(self, request, pk=None):
        serializer = AppointmentOutcomeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            appointment = self.get_queryset().select_for_update(of=("self",)).get(pk=self.get_object().pk)
            record_outcome(appointment, outcome=serializer.validated_data["outcome"], actor=request.user)
        security_logger.info("appointment_outcome_recorded appointment_id=%s actor_id=%s", appointment.id, request.user.id)
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


class ProfessionalAppointmentViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (IsActiveProfessional,)
    serializer_class = AppointmentSerializer
    pagination_class = CompanyAppointmentPagination

    def get_queryset(self):
        professional = professional_for_user(self.request.user)
        expire_pending_appointments(professional=professional)
        return Appointment.objects.filter(professional=professional).select_related(
            "company__booking_settings", "service", "professional", "customer", "review", "unit"
        )

    @action(detail=False, methods=("get",))
    def services(self, request):
        from services.serializers import PublicServiceSerializer

        professional = professional_for_user(request.user)
        query = UnitQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        queryset = professional.services.filter(company=professional.company, is_active=True, units__in=professional.units.filter(is_active=True)).distinct().prefetch_related("units")
        if unit_id := query.validated_data.get("unit"):
            unit = resolve_company_unit(professional.company, unit_id)
            get_object_or_404(professional.units, pk=unit.pk)
            queryset = queryset.filter(units=unit)
        return Response(PublicServiceSerializer(queryset, many=True).data)

    @action(detail=False, methods=("get",))
    def units(self, request):
        from companies.serializers import CompanyUnitSerializer
        professional = professional_for_user(request.user)
        return Response(CompanyUnitSerializer(professional.units.filter(is_active=True), many=True).data)

    @action(detail=False, methods=("post",), serializer_class=ManualAppointmentCreateSerializer)
    def manual(self, request):
        serializer = ManualAppointmentCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        professional = professional_for_user(request.user)
        appointment, _ = create_appointment(
            company=professional.company,
            unit_id=serializer.validated_data.get("unit"),
            service_id=serializer.validated_data["service"],
            professional_id=professional.id,
            starts_at=serializer.validated_data["starts_at"],
            customer=None,
            customer_data=serializer.customer_snapshot(),
            origin=Appointment.Origin.PROFESSIONAL,
        )
        security_logger.info("manual_appointment_created appointment_id=%s actor_id=%s", appointment.id, request.user.id)
        return Response(AppointmentSerializer(appointment, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), serializer_class=AppointmentOutcomeSerializer)
    def outcome(self, request, pk=None):
        serializer = AppointmentOutcomeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            appointment = self.get_queryset().select_for_update(of=("self",)).filter(pk=pk).first()
            if not appointment:
                from rest_framework.exceptions import NotFound
                raise NotFound()
            record_outcome(appointment, outcome=serializer.validated_data["outcome"], actor=request.user)
        security_logger.info("appointment_outcome_recorded appointment_id=%s actor_id=%s", appointment.id, request.user.id)
        return Response(AppointmentSerializer(appointment, context={"request": request}).data)


class CompanyDashboardView(generics.GenericAPIView):
    permission_classes = (IsActiveCompanyAdmin,)

    def get(self, request):
        company = company_for_user(request.user)
        expire_pending_appointments(company=company)
        today = timezone.localdate()
        appointments = Appointment.objects.filter(company=company)
        today_qs = appointments.filter(starts_at__date=today)
        counts = today_qs.aggregate(
            total=Count("id"),
            waiting=Count("id", filter=Q(status=Appointment.Status.WAITING_CONFIRMATION)),
            confirmed=Count("id", filter=Q(status=Appointment.Status.CONFIRMED, outcome__isnull=True)),
            cancelled=Count("id", filter=Q(status=Appointment.Status.CANCELLED)),
            completed=Count("id", filter=Q(outcome=Appointment.Outcome.COMPLETED)),
            no_show=Count("id", filter=Q(outcome=Appointment.Outcome.NO_SHOW)),
        )
        next_items = appointments.filter(starts_at__gte=timezone.now()).exclude(status=Appointment.Status.CANCELLED).select_related(
            "company__booking_settings", "service", "professional", "customer", "review", "unit"
        ).order_by("starts_at")[:10]
        return Response({**counts, "next_appointments": AppointmentSerializer(next_items, many=True, context={"request": request}).data})


class CompanyReportView(generics.GenericAPIView):
    permission_classes = (IsActiveCompanyAdmin,)

    def get(self, request):
        expire_pending_appointments(company=company_for_user(request.user))
        date_field = serializers.DateField()
        try:
            date_from = date_field.to_internal_value(request.query_params.get("date_from"))
            date_to = date_field.to_internal_value(request.query_params.get("date_to"))
        except (serializers.ValidationError, TypeError):
            raise ValidationError({"period": "Informe date_from e date_to no formato AAAA-MM-DD."})
        if date_from > date_to or (date_to - date_from).days > 366:
            raise ValidationError({"period": "O período deve ser válido e ter no máximo 366 dias."})
        qs = Appointment.objects.filter(company=company_for_user(request.user), starts_at__date__range=(date_from, date_to))
        totals = qs.aggregate(
            total=Count("id"),
            completed=Count("id", filter=Q(outcome=Appointment.Outcome.COMPLETED)),
            cancelled=Count("id", filter=Q(status=Appointment.Status.CANCELLED)),
            no_show=Count("id", filter=Q(outcome=Appointment.Outcome.NO_SHOW)),
        )
        attended = totals["completed"] + totals["no_show"]
        totals["attendance_rate"] = round(totals["completed"] * 100 / attended, 1) if attended else 0
        totals["no_show_rate"] = round(totals["no_show"] * 100 / attended, 1) if attended else 0
        top = lambda field: list(qs.values(field).annotate(total=Count("id")).order_by("-total", field)[:10])
        return Response({
            **totals,
            "services": top("service__name"),
            "professionals": top("professional__name"),
            "weekdays": list(qs.annotate(value=ExtractWeekDay("starts_at")).values("value").annotate(total=Count("id")).order_by("-total")),
            "hours": list(qs.annotate(value=ExtractHour("starts_at")).values("value").annotate(total=Count("id")).order_by("-total")),
            "recurring_customers": recurring_customers(qs),
        })


class CompanyReviewViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (IsActiveCompanyAdmin,)
    serializer_class = ReviewSerializer

    def get_queryset(self):
        return Review.objects.filter(company=company_for_user(self.request.user)).select_related("appointment")

    @action(detail=True, methods=("post",), serializer_class=ReviewResponseSerializer)
    def respond(self, request, pk=None):
        review = self.get_object()
        serializer = ReviewResponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review.company_response = serializer.validated_data["company_response"]
        review.responded_at = timezone.now() if review.company_response else None
        review.save(update_fields=("company_response", "responded_at", "updated_at"))
        return Response(ReviewSerializer(review).data)


class PublicReviewCreateView(generics.GenericAPIView):
    permission_classes = (AllowAny,)
    serializer_class = ReviewCreateSerializer
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "public_review"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data.pop("review_token", "")
        if not token:
            raise ValidationError({"review_token": "Token inválido ou expirado."})
        with transaction.atomic():
            credential = ReviewCredential.objects.select_for_update().select_related("appointment").filter(
                digest=ReviewCredential.digest_secret(token), consumed_at__isnull=True, expires_at__gt=timezone.now()
            ).first()
            if not credential or credential.appointment.outcome != Appointment.Outcome.COMPLETED:
                raise ValidationError({"review_token": "Token inválido ou expirado."})
            try:
                review = Review.objects.create(
                    appointment=credential.appointment,
                    company=credential.appointment.company,
                    rating=serializer.validated_data["rating"],
                    comment=serializer.validated_data.get("comment", ""),
                )
            except IntegrityError as exc:
                raise ValidationError("Este atendimento já foi avaliado.") from exc
            credential.consumed_at = timezone.now()
            credential.save(update_fields=("consumed_at", "updated_at"))
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)


class PushConfigView(generics.GenericAPIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def get(self, request):
        from django.conf import settings
        configured = all((settings.WEB_PUSH_VAPID_PUBLIC_KEY, settings.WEB_PUSH_VAPID_PRIVATE_KEY, settings.WEB_PUSH_VAPID_SUBJECT))
        return Response({"public_key": settings.WEB_PUSH_VAPID_PUBLIC_KEY if configured else ""})


class PushSubscriptionView(generics.GenericAPIView):
    permission_classes = (AllowAny,)
    serializer_class = PushSubscriptionSerializer
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "push_subscription"

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        user = request.user if request.user.is_authenticated else None
        if user and user.notification_preference is False:
            raise ValidationError("As notificações estão desativadas nas configurações da conta.")
        if user:
            appointment = Appointment.objects.filter(pk=values["appointment"], customer=user).first()
        else:
            token = values.get("management_token", "")
            credential = AppointmentManagementCredential.objects.select_related("appointment").filter(
                digest=AppointmentManagementCredential.digest_secret(token)
            ).first() if token else None
            appointment = credential.appointment if credential and credential.appointment_id == values["appointment"] else None
        if not appointment:
            from rest_framework.exceptions import NotFound
            raise NotFound("Agendamento não encontrado.")
        digest = PushSubscription.digest_endpoint(values["endpoint"])
        with transaction.atomic():
            subscription, created = PushSubscription.objects.select_for_update().get_or_create(
                endpoint_digest=digest,
                defaults={
                    "endpoint": values["endpoint"], "p256dh": values["p256dh"], "auth": values["auth"],
                    "user": user, "active": True, "consented_at": timezone.now(),
                },
            )
            if not created:
                if user and subscription.user_id not in (None, user.id):
                    raise ValidationError("A inscrição não pode ser vinculada.")
                subscription.endpoint = values["endpoint"]
                subscription.p256dh = values["p256dh"]
                subscription.auth = values["auth"]
                subscription.user = subscription.user or user
                subscription.active = True
                subscription.revoked_at = None
                subscription.consented_at = timezone.now()
                subscription.save(update_fields=("endpoint", "p256dh", "auth", "user", "active", "revoked_at", "consented_at", "updated_at"))
            BookingPushSubscription.objects.get_or_create(appointment=appointment, subscription=subscription)
        return Response({"id": subscription.id, "active": subscription.active}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class CustomerAppointmentViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (IsCustomer,)
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        expire_pending_appointments(customer=self.request.user)
        query = AppointmentPeriodSerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        queryset = Appointment.objects.filter(customer=self.request.user).select_related(
            "company__booking_settings", "service", "professional", "customer", "review", "unit"
        )
        if start := query.validated_data.get("start_date"):
            end = query.validated_data["end_date"]
            queryset = queryset.filter(
                starts_at__gte=timezone.make_aware(datetime.combine(start, time.min)),
                starts_at__lt=timezone.make_aware(datetime.combine(end + timedelta(days=1), time.min)),
            )
        return queryset

    @action(detail=False, methods=("get",))
    def calendar(self, request):
        query = AppointmentPeriodSerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        start, end = query.validated_data.get("start_date"), query.validated_data.get("end_date")
        if not start or (end - start).days > 30:
            raise ValidationError("Informe um período de até 31 dias para o calendário.")
        queryset = self.get_queryset()
        day = TruncDate("starts_at", tzinfo=timezone.get_default_timezone())
        days = list(queryset.order_by().annotate(date=day).values("date").annotate(count=Count("pk")).order_by("date"))
        previews = queryset.annotate(day_row=Window(RowNumber(), partition_by=[day], order_by=[F("starts_at").asc(), F("pk").asc()])).filter(day_row__lte=3).order_by("starts_at", "pk")
        return Response({"days": days, "events": self.get_serializer(previews, many=True).data})

    @action(detail=False, methods=("get",))
    def stats(self, request):
        values = self.get_queryset().aggregate(
            total=Count("id"),
            completed=Count("id", filter=Q(outcome=Appointment.Outcome.COMPLETED)),
            no_show=Count("id", filter=Q(outcome=Appointment.Outcome.NO_SHOW)),
        )
        decided = values["completed"] + values["no_show"]
        values["attendance_rate"] = round(values["completed"] * 100 / decided, 1) if decided else 0
        values["no_show_rate"] = round(values["no_show"] * 100 / decided, 1) if decided else 0
        return Response(values)

    @action(detail=True, methods=("post",), serializer_class=ReviewCreateSerializer)
    def review(self, request, pk=None):
        appointment = self.get_object()
        if appointment.outcome != Appointment.Outcome.COMPLETED:
            raise ValidationError("Somente atendimentos concluídos podem ser avaliados.")
        serializer = ReviewCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.validated_data.pop("review_token", None)
        try:
            with transaction.atomic():
                review = Review.objects.create(
                    appointment=appointment,
                    company=appointment.company,
                    customer=request.user,
                    **serializer.validated_data,
                )
        except IntegrityError as exc:
            raise ValidationError("Este atendimento já foi avaliado.") from exc
        return Response(ReviewSerializer(review).data, status=status.HTTP_201_CREATED)

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
