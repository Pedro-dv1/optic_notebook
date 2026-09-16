import hashlib
import uuid
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from platform_core.models import UUIDTimestampedModel
from platform_core.validators import validate_company_slug


def company_logo_path(instance, filename):
    extension = Path(filename).suffix.lower()
    return f"company-logos/{instance.id}/{uuid.uuid4().hex}{extension}"


class Company(UUIDTimestampedModel):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Ativa"
        SUSPENDED = "SUSPENDED", "Suspensa"

    class Niche(models.TextChoices):
        BEAUTY = "Beauty", "Beleza"
        HEALTH = "Health", "Saúde"
        WELLNESS = "Wellness", "Bem-estar"
        FITNESS = "Fitness", "Atividade física"
        AUTOMOTIVE = "Automotive", "Automotivo"
        EDUCATION = "Education", "Educação"
        PETS = "Pets", "Cuidados para pets"
        OTHER = "Other", "Outros"

    class BusinessType(models.TextChoices):
        BARBERSHOP = "Barbershop", "Barbearia"
        BEAUTY_SALON = "Salon", "Salão de beleza"
        AESTHETICS_CLINIC = "Aesthetics clinic", "Clínica de estética"
        MEDICAL_CLINIC = "Clinic", "Clínica"
        MEDICAL_OFFICE = "Medical office", "Consultório"
        DENTAL_CLINIC = "Dental clinic", "Clínica odontológica"
        PHYSIOTHERAPY = "Physiotherapy", "Fisioterapia"
        PILATES_STUDIO = "Pilates studio", "Estúdio de pilates"
        GYM = "Gym", "Academia"
        SPA = "Spa", "Spa"
        MANICURE = "Manicure", "Manicure"
        AUTO_REPAIR = "Auto repair", "Oficina"
        AUTO_DETAILING = "Auto detailing", "Estética automotiva"
        PET_CARE = "Pet care", "Pet shop e cuidados"
        CONSULTING = "Consulting", "Consultoria"
        OTHER = "Other", "Outro"

    STATE_CHOICES = (
        ("AC", "Acre"), ("AL", "Alagoas"), ("AP", "Amapá"), ("AM", "Amazonas"),
        ("BA", "Bahia"), ("CE", "Ceará"), ("DF", "Distrito Federal"), ("ES", "Espírito Santo"),
        ("GO", "Goiás"), ("MA", "Maranhão"), ("MT", "Mato Grosso"), ("MS", "Mato Grosso do Sul"),
        ("MG", "Minas Gerais"), ("PA", "Pará"), ("PB", "Paraíba"), ("PR", "Paraná"),
        ("PE", "Pernambuco"), ("PI", "Piauí"), ("RJ", "Rio de Janeiro"),
        ("RN", "Rio Grande do Norte"), ("RS", "Rio Grande do Sul"), ("RO", "Rondônia"),
        ("RR", "Roraima"), ("SC", "Santa Catarina"), ("SP", "São Paulo"),
        ("SE", "Sergipe"), ("TO", "Tocantins"),
    )

    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="owned_company",
    )
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=80, unique=True, validators=[validate_company_slug])
    tax_identifier = models.CharField(max_length=14, blank=True)
    whatsapp = models.CharField(max_length=20)
    address = models.CharField(max_length=300, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=2, choices=STATE_CHOICES, blank=True)
    niche = models.CharField(max_length=100, choices=Niche.choices)
    niche_custom = models.CharField(max_length=100, blank=True)
    business_type = models.CharField(max_length=100, choices=BusinessType.choices)
    business_type_custom = models.CharField(max_length=100, blank=True)
    public_notes = models.TextField(blank=True, max_length=4000)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    logo = models.ImageField(upload_to=company_logo_path, null=True, blank=True)
    theme_primary = models.CharField(max_length=7, default="#123A73")
    theme_background = models.CharField(max_length=7, default="#0B0D12")
    theme_surface = models.CharField(max_length=7, default="#141821")
    theme_text = models.CharField(max_length=7, default="#F4F7FB")
    theme_accent = models.CharField(max_length=7, default="#2F80ED")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("tax_identifier",),
                condition=~Q(tax_identifier=""),
                name="unique_nonempty_company_tax_identifier",
            )
        ]
        indexes = [
            models.Index(fields=("status", "state", "city"), name="company_discovery_place_idx"),
            models.Index(fields=("status", "niche", "business_type"), name="company_discovery_type_idx"),
        ]
        ordering = ("name",)

    def __str__(self):
        return self.name


BUSINESS_TYPES_BY_NICHE = {
    Company.Niche.BEAUTY: (
        Company.BusinessType.BARBERSHOP,
        Company.BusinessType.BEAUTY_SALON,
        Company.BusinessType.AESTHETICS_CLINIC,
        Company.BusinessType.MANICURE,
        Company.BusinessType.OTHER,
    ),
    Company.Niche.HEALTH: (
        Company.BusinessType.MEDICAL_CLINIC,
        Company.BusinessType.MEDICAL_OFFICE,
        Company.BusinessType.DENTAL_CLINIC,
        Company.BusinessType.PHYSIOTHERAPY,
        Company.BusinessType.OTHER,
    ),
    Company.Niche.WELLNESS: (
        Company.BusinessType.SPA,
        Company.BusinessType.PILATES_STUDIO,
        Company.BusinessType.AESTHETICS_CLINIC,
        Company.BusinessType.OTHER,
    ),
    Company.Niche.FITNESS: (Company.BusinessType.GYM, Company.BusinessType.PILATES_STUDIO, Company.BusinessType.OTHER),
    Company.Niche.AUTOMOTIVE: (Company.BusinessType.AUTO_REPAIR, Company.BusinessType.AUTO_DETAILING, Company.BusinessType.OTHER),
    Company.Niche.EDUCATION: (Company.BusinessType.CONSULTING, Company.BusinessType.OTHER),
    Company.Niche.PETS: (Company.BusinessType.PET_CARE, Company.BusinessType.OTHER),
    Company.Niche.OTHER: (Company.BusinessType.CONSULTING, Company.BusinessType.OTHER),
}


class CompanyBookingSettings(UUIDTimestampedModel):
    company = models.OneToOneField(Company, on_delete=models.CASCADE, related_name="booking_settings")
    slot_interval = models.DurationField(default=timedelta(minutes=30), validators=[MinValueValidator(timedelta(minutes=5))])
    late_tolerance = models.DurationField(default=timedelta(minutes=10), validators=[MinValueValidator(timedelta())])
    minimum_change_notice = models.DurationField(
        default=timedelta(hours=24),
        validators=[MinValueValidator(timedelta())],
    )

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(slot_interval__gte=timedelta(minutes=5), slot_interval__lte=timedelta(days=1)),
                name="booking_slot_interval_range",
            ),
            models.CheckConstraint(
                condition=Q(late_tolerance__gte=timedelta(), late_tolerance__lte=timedelta(days=1)),
                name="booking_late_tolerance_range",
            ),
            models.CheckConstraint(
                condition=Q(minimum_change_notice__gte=timedelta(), minimum_change_notice__lte=timedelta(days=365)),
                name="booking_change_notice_range",
            ),
        ]


class CompanyDailyMetric(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="daily_metrics")
    date = models.DateField()
    views = models.PositiveIntegerField(default=0)
    unique_visitors = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("company", "date"), name="unique_company_daily_metric"),
        ]
        ordering = ("-date",)


class CompanyViewVisitor(models.Model):
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="view_visitors")
    date = models.DateField()
    visitor_digest = models.CharField(max_length=64, editable=False)
    last_viewed_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("company", "date", "visitor_digest"),
                name="unique_company_daily_visitor",
            ),
        ]
        indexes = [
            models.Index(fields=("company", "date"), name="company_visitor_period_idx"),
        ]

    @staticmethod
    def digest_visitor(identifier):
        return hashlib.sha256(identifier.encode("utf-8")).hexdigest()
