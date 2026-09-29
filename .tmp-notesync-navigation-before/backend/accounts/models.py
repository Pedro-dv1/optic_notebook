import uuid
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models

from .managers import UserManager


def customer_avatar_path(instance, filename):
    extension = Path(filename).suffix.lower()
    return f"customer-avatars/{instance.id}/{uuid.uuid4().hex}{extension}"


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = None
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=150)
    whatsapp = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to=customer_avatar_path, null=True, blank=True)
    auth_version = models.PositiveIntegerField(default=0, editable=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    objects = UserManager()

    def save(self, *args, **kwargs):
        self.email = self.__class__.objects.normalize_email(self.email).lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


class AccountVerificationChallenge(models.Model):
    class Purpose(models.TextChoices):
        PASSWORD_CHANGE = "PASSWORD_CHANGE", "Alteração de senha"
        EMAIL_CHANGE_CURRENT = "EMAIL_CHANGE_CURRENT", "Confirmação do e-mail atual"
        EMAIL_CHANGE_NEW = "EMAIL_CHANGE_NEW", "Confirmação do novo e-mail"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="verification_challenges")
    purpose = models.CharField(max_length=32, choices=Purpose.choices)
    code_hash = models.CharField(max_length=128, editable=False)
    target_email = models.EmailField(blank=True)
    authorization = models.ForeignKey(
        "AccountActionAuthorization",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="challenges",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    sent_at = models.DateTimeField(null=True, blank=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    request_ip_digest = models.CharField(max_length=64, blank=True, editable=False)
    request_user_agent = models.CharField(max_length=255, blank=True, editable=False)

    class Meta:
        indexes = [
            models.Index(fields=("user", "purpose", "expires_at"), name="account_otp_lookup_idx"),
        ]
        ordering = ("-created_at",)


class AccountActionAuthorization(models.Model):
    class Purpose(models.TextChoices):
        PASSWORD_CHANGE = "PASSWORD_CHANGE", "Alteração de senha"
        EMAIL_CHANGE = "EMAIL_CHANGE", "Alteração de e-mail"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="account_authorizations")
    purpose = models.CharField(max_length=32, choices=Purpose.choices)
    token_digest = models.CharField(max_length=64, unique=True, editable=False)
    email_candidate = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=("user", "purpose", "expires_at"), name="account_auth_lookup_idx"),
        ]


class AccountSecurityRateLimit(models.Model):
    key_digest = models.CharField(max_length=64)
    endpoint = models.CharField(max_length=64)
    purpose = models.CharField(max_length=32, blank=True)
    window_started_at = models.DateTimeField()
    hits = models.PositiveSmallIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("key_digest", "endpoint", "purpose", "window_started_at"),
                name="unique_account_security_rate_window",
            ),
        ]
        indexes = [
            models.Index(fields=("window_started_at",), name="account_rate_window_idx"),
        ]
