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
