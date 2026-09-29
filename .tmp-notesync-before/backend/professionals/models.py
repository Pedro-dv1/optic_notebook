import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models, transaction
from django.db.models import F, Q
from django.utils import timezone

from platform_core.models import UUIDTimestampedModel


class Professional(UUIDTimestampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="professionals")
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)
    services = models.ManyToManyField("services.Service", related_name="professionals", blank=True)
    units = models.ManyToManyField("companies.CompanyUnit", related_name="professionals", blank=True)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="professional_profile",
        null=True,
        blank=True,
    )
    access_active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("company", "name"), name="unique_professional_name_per_company")]
        ordering = ("name",)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        creating = self._state.adding
        with transaction.atomic():
            super().save(*args, **kwargs)
            if creating:
                primary = self.company.units.filter(is_primary=True).first()
                if primary:
                    self.units.add(primary)


class WorkSchedule(UUIDTimestampedModel):
    professional = models.ForeignKey(Professional, on_delete=models.CASCADE, related_name="work_schedules")
    unit = models.ForeignKey("companies.CompanyUnit", on_delete=models.PROTECT, null=True, blank=True, related_name="work_schedules")
    weekday = models.PositiveSmallIntegerField(choices=[(day, str(day)) for day in range(7)])
    starts_at = models.TimeField()
    ends_at = models.TimeField()

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(starts_at__lt=F("ends_at")), name="schedule_start_before_end"),
            models.CheckConstraint(condition=Q(weekday__gte=0, weekday__lte=6), name="schedule_valid_weekday"),
            models.UniqueConstraint(
                fields=("professional", "weekday", "starts_at", "ends_at"),
                name="unique_professional_schedule",
            ),
        ]
        ordering = ("weekday", "starts_at")

    def save(self, *args, **kwargs):
        if self._state.adding and not self.unit_id:
            self.unit = self.professional.company.units.filter(is_primary=True).first()
        super().save(*args, **kwargs)


class ProfessionalUnavailability(UUIDTimestampedModel):
    class Kind(models.TextChoices):
        HOURS = "HOURS", "Bloqueio de horas"
        DAY_OFF = "DAY_OFF", "Folga"
        VACATION = "VACATION", "Férias"
        APPOINTMENT = "APPOINTMENT", "Compromisso"
        OTHER = "OTHER", "Outra indisponibilidade"

    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="unavailabilities")
    professional = models.ForeignKey(Professional, on_delete=models.CASCADE, related_name="unavailabilities")
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.HOURS)
    reason = models.CharField(max_length=500, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_unavailabilities")

    class Meta:
        constraints = [
            models.CheckConstraint(condition=Q(starts_at__lt=F("ends_at")), name="unavailability_start_before_end"),
        ]
        indexes = [
            models.Index(fields=("company", "professional", "starts_at", "ends_at"), name="unavailability_period_idx"),
        ]
        ordering = ("starts_at",)


class ProfessionalAccessInvite(UUIDTimestampedModel):
    professional = models.ForeignKey(Professional, on_delete=models.CASCADE, related_name="access_invites")
    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="professional_invites")
    digest = models.CharField(max_length=64, unique=True, editable=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_professional_invites")
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=("company", "professional", "expires_at"), name="professional_invite_idx")]
        ordering = ("-created_at",)

    @staticmethod
    def digest_secret(secret):
        return hashlib.sha256(secret.encode("utf-8")).hexdigest()

    @classmethod
    def issue(cls, *, professional, created_by, ttl=timedelta(days=7)):
        # ASVS v5.0.0-11.5.1: access keys use the operating system CSPRNG.
        alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        secret = "".join(secrets.choice(alphabet) for _ in range(12))
        instance = cls.objects.create(
            professional=professional,
            company=professional.company,
            digest=cls.digest_secret(secret),
            created_by=created_by,
            expires_at=timezone.now() + ttl,
        )
        return instance, secret

    @property
    def state(self):
        if self.used_at:
            return "USED"
        if self.revoked_at:
            return "REVOKED"
        if self.expires_at <= timezone.now():
            return "EXPIRED"
        return "ACTIVE"
