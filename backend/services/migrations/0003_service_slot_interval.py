import datetime

from django.core.validators import MinValueValidator
from django.db import migrations, models
from django.db.models import Q


def copy_company_intervals(apps, schema_editor):
    Service = apps.get_model("services", "Service")
    BookingSettings = apps.get_model("companies", "CompanyBookingSettings")
    intervals = dict(BookingSettings.objects.values_list("company_id", "slot_interval"))
    for service in Service.objects.only("id", "company_id").iterator():
        service.slot_interval = intervals.get(service.company_id, datetime.timedelta(minutes=30))
        service.save(update_fields=("slot_interval",))


class Migration(migrations.Migration):
    dependencies = [
        ("companies", "0006_company_custom_labels_and_public_notes"),
        ("services", "0002_service_service_duration_range_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="service",
            name="slot_interval",
            field=models.DurationField(null=True),
        ),
        migrations.RunPython(copy_company_intervals, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="service",
            name="slot_interval",
            field=models.DurationField(
                default=datetime.timedelta(seconds=1800),
                validators=[MinValueValidator(datetime.timedelta(seconds=300))],
            ),
        ),
        migrations.AddConstraint(
            model_name="service",
            constraint=models.CheckConstraint(
                condition=Q(
                    slot_interval__gte=datetime.timedelta(seconds=300),
                    slot_interval__lte=datetime.timedelta(days=1),
                ),
                name="service_slot_interval_range",
            ),
        ),
    ]
