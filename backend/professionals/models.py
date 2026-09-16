from django.db import models
from django.db.models import F, Q

from platform_core.models import UUIDTimestampedModel


class Professional(UUIDTimestampedModel):
    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="professionals")
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)
    services = models.ManyToManyField("services.Service", related_name="professionals", blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=("company", "name"), name="unique_professional_name_per_company")]
        ordering = ("name",)

    def __str__(self):
        return self.name


class WorkSchedule(UUIDTimestampedModel):
    professional = models.ForeignKey(Professional, on_delete=models.CASCADE, related_name="work_schedules")
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
