from datetime import timedelta

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

from platform_core.models import UUIDTimestampedModel


class Service(UUIDTimestampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="services")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, max_length=2000)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, validators=[MinValueValidator(0)])
    duration = models.DurationField(validators=[MinValueValidator(timedelta(minutes=5))])
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("company", "name"), name="unique_service_name_per_company"),
            models.CheckConstraint(
                condition=Q(duration__gte=timedelta(minutes=5), duration__lte=timedelta(days=1)),
                name="service_duration_range",
            ),
            models.CheckConstraint(condition=Q(price__gte=0) | Q(price__isnull=True), name="service_nonnegative_price"),
        ]
        ordering = ("name",)

    def __str__(self):
        return self.name
