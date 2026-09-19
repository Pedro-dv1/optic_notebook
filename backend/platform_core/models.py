import hashlib
import secrets
import uuid

from django.conf import settings
from django.db import models


class UUIDTimestampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class RegistrationKey(UUIDTimestampedModel):
    digest = models.CharField(max_length=64, unique=True, editable=False)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_registration_keys",
    )
    consumed_at = models.DateTimeField(null=True, blank=True)
    consumed_by_company = models.OneToOneField(
        "companies.Company",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="registration_key",
    )

    class Meta:
        ordering = ("-created_at",)

    @staticmethod
    def digest_secret(secret):
        return hashlib.sha256(secret.encode("utf-8")).hexdigest()

    @classmethod
    def issue(cls, created_by):
        secret = f"obn_rk_{secrets.token_urlsafe(32)}"
        instance = cls.objects.create(digest=cls.digest_secret(secret), created_by=created_by)
        return instance, secret

    @property
    def state(self):
        if self.consumed_at:
            return "CONSUMED"
        return "ACTIVE" if self.is_active else "INACTIVE"


class LegalAcceptance(models.Model):
    class DocumentType(models.TextChoices):
        TERMS = "TERMS", "Termos de Uso"
        PRIVACY = "PRIVACY", "Política de Privacidade"

    class Context(models.TextChoices):
        CUSTOMER_REGISTER = "CUSTOMER_REGISTER", "Cadastro de cliente"
        COMPANY_REGISTER = "COMPANY_REGISTER", "Cadastro de empresa"
        ANONYMOUS_BOOKING = "ANONYMOUS_BOOKING", "Agendamento anônimo"
        EXISTING_USER_REACCEPTANCE = "EXISTING_USER_REACCEPTANCE", "Novo aceite de usuário existente"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="legal_acceptances",
    )
    company = models.ForeignKey(
        "companies.Company",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="legal_acceptances",
    )
    appointment = models.ForeignKey(
        "bookings.Appointment",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="legal_acceptances",
    )
    document_type = models.CharField(max_length=16, choices=DocumentType.choices)
    document_version = models.CharField(max_length=32)
    context = models.CharField(max_length=40, choices=Context.choices)
    accepted_at = models.DateTimeField(auto_now_add=True, editable=False)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=models.Q(user__isnull=False) | models.Q(company__isnull=False) | models.Q(appointment__isnull=False),
                name="legal_acceptance_has_subject",
            ),
            models.UniqueConstraint(
                fields=("user", "document_type", "document_version"),
                condition=models.Q(user__isnull=False),
                name="unique_user_legal_version",
            ),
            models.UniqueConstraint(
                fields=("appointment", "document_type", "document_version"),
                condition=models.Q(appointment__isnull=False),
                name="unique_booking_legal_version",
            ),
        ]
        ordering = ("-accepted_at",)
