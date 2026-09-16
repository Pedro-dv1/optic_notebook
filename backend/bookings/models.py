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

    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT, related_name="appointments")
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
        ]
        ordering = ("-starts_at",)


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
