import hashlib
import secrets

from django.conf import settings
from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField, RangeBoundary, RangeOperators
from django.db import models
from django.db.models import F, Func, Q

from platform_core.models import UUIDTimestampedModel


class Appointment(UUIDTimestampedModel):
    class Status(models.TextChoices):
        WAITING_CONFIRMATION = "WAITING_CONFIRMATION", "Aguardando confirmação"
        CONFIRMED = "CONFIRMED", "Confirmado"
        CANCELLED = "CANCELLED", "Cancelado"

    class Outcome(models.TextChoices):
        COMPLETED = "COMPLETED", "Concluído"
        NO_SHOW = "NO_SHOW", "Não compareceu"

    class Origin(models.TextChoices):
        CUSTOMER = "CUSTOMER", "Cliente"
        ADMIN = "ADMIN", "Administrador"
        PROFESSIONAL = "PROFESSIONAL", "Profissional"

    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT, related_name="appointments")
    unit = models.ForeignKey("companies.CompanyUnit", on_delete=models.PROTECT, null=True, blank=True, related_name="appointments")
    service = models.ForeignKey("services.Service", on_delete=models.PROTECT, related_name="appointments")
    professional = models.ForeignKey("professionals.Professional", on_delete=models.PROTECT, related_name="appointments")
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="appointments",
    )
    customer_name = models.CharField(max_length=150)
    customer_email = models.EmailField()
    customer_whatsapp = models.CharField(max_length=20)
    customer_notes = models.TextField(blank=True, max_length=2000)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.WAITING_CONFIRMATION)
    cancellation_reason = models.CharField(max_length=32, blank=True)
    outcome = models.CharField(max_length=16, choices=Outcome.choices, null=True, blank=True)
    outcome_recorded_at = models.DateTimeField(null=True, blank=True)
    outcome_recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="recorded_appointment_outcomes",
    )
    origin = models.CharField(max_length=16, choices=Origin.choices, default=Origin.CUSTOMER)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(starts_at__lt=F("ends_at")), name="appointment_start_before_end"),
            ExclusionConstraint(
                name="exclude_overlapping_professional_appointments",
                expressions=(
                    (
                        Func(
                            F("starts_at"),
                            F("ends_at"),
                            RangeBoundary(),
                            function="TSTZRANGE",
                            output_field=DateTimeRangeField(),
                        ),
                        RangeOperators.OVERLAPS,
                    ),
                    ("professional", RangeOperators.EQUAL),
                ),
                condition=Q(status__in=("WAITING_CONFIRMATION", "CONFIRMED")),
            ),
        ]
        indexes = [
            models.Index(fields=("company", "starts_at"), name="appointment_company_start_idx"),
            models.Index(fields=("customer", "starts_at"), name="appointment_customer_start_idx"),
            models.Index(fields=("starts_at",), condition=Q(status="WAITING_CONFIRMATION", outcome__isnull=True), name="appointment_pending_due_idx"),
        ]
        ordering = ("-starts_at",)


class AppointmentOutcomeEvent(UUIDTimestampedModel):
    appointment = models.ForeignKey(Appointment, on_delete=models.PROTECT, related_name="outcome_events")
    outcome = models.CharField(max_length=16, choices=Appointment.Outcome.choices)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="appointment_outcome_events")

    class Meta:
        indexes = [models.Index(fields=("appointment", "created_at"), name="appointment_outcome_event_idx")]
        ordering = ("-created_at",)


class AppointmentManagementCredential(UUIDTimestampedModel):
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name="management_credential")
    digest = models.CharField(max_length=64, unique=True, editable=False)

    @staticmethod
    def digest_secret(secret):
        return hashlib.sha256(secret.encode("utf-8")).hexdigest()

    @classmethod
    def issue(cls, appointment):
        secret = f"obn_appt_{secrets.token_urlsafe(32)}"
        cls.objects.create(appointment=appointment, digest=cls.digest_secret(secret))
        return secret


class Review(UUIDTimestampedModel):
    appointment = models.OneToOneField(Appointment, on_delete=models.PROTECT, related_name="review")
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT, related_name="reviews")
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviews")
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True, max_length=2000)
    company_response = models.TextField(blank=True, max_length=2000)
    responded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.CheckConstraint(condition=Q(rating__gte=1, rating__lte=5), name="review_rating_range")]
        indexes = [models.Index(fields=("company", "created_at"), name="review_company_created_idx")]


class ReviewCredential(UUIDTimestampedModel):
    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name="review_credential")
    digest = models.CharField(max_length=64, unique=True, editable=False)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)

    @staticmethod
    def digest_secret(secret):
        return hashlib.sha256(secret.encode("utf-8")).hexdigest()

    @classmethod
    def issue(cls, appointment, *, expires_at):
        secret = f"obn_review_{secrets.token_urlsafe(32)}"
        credential, _ = cls.objects.update_or_create(
            appointment=appointment,
            defaults={"digest": cls.digest_secret(secret), "expires_at": expires_at, "consumed_at": None},
        )
        return credential, secret


class PushSubscription(UUIDTimestampedModel):
    endpoint = models.TextField()
    endpoint_digest = models.CharField(max_length=64, unique=True, editable=False)
    p256dh = models.CharField(max_length=256)
    auth = models.CharField(max_length=128)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="push_subscriptions")
    active = models.BooleanField(default=True)
    permission_source = models.CharField(max_length=32, default="BOOKING_REMINDERS")
    consented_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)

    @staticmethod
    def digest_endpoint(endpoint):
        return hashlib.sha256(endpoint.encode("utf-8")).hexdigest()


class BookingPushSubscription(UUIDTimestampedModel):
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name="push_links")
    subscription = models.ForeignKey(PushSubscription, on_delete=models.CASCADE, related_name="booking_links")

    class Meta:
        constraints = [models.UniqueConstraint(fields=("appointment", "subscription"), name="unique_booking_push_subscription")]


class NotificationEvent(UUIDTimestampedModel):
    class Kind(models.TextChoices):
        BOOKING_CONFIRMED = "BOOKING_CONFIRMED", "Agendamento confirmado"
        BOOKING_REMINDER = "BOOKING_REMINDER", "Lembrete de agendamento"
        BOOKING_RESCHEDULED = "BOOKING_RESCHEDULED", "Agendamento reagendado"
        BOOKING_CANCELLED = "BOOKING_CANCELLED", "Agendamento cancelado"
        REVIEW_REQUEST = "REVIEW_REQUEST", "Solicitação de avaliação"

    class State(models.TextChoices):
        PENDING = "PENDING", "Pendente"
        SENT = "SENT", "Enviado"
        FAILED = "FAILED", "Falhou"

    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name="notification_events")
    kind = models.CharField(max_length=32, choices=Kind.choices)
    scheduled_for = models.DateTimeField()
    state = models.CharField(max_length=16, choices=State.choices, default=State.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("appointment", "kind", "scheduled_for"), name="unique_booking_notification_event"),
        ]
        indexes = [models.Index(fields=("state", "scheduled_for"), name="notification_due_idx")]
