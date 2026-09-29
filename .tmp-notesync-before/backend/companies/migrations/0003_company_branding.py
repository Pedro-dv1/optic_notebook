import companies.models
import platform_core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("companies", "0002_companybookingsettings_booking_slot_interval_range_and_more")]

    operations = [
        migrations.AlterField(
            model_name="company",
            name="slug",
            field=models.SlugField(max_length=80, unique=True, validators=[platform_core.validators.validate_company_slug]),
        ),
        migrations.AddField(
            model_name="company",
            name="logo",
            field=models.ImageField(blank=True, null=True, upload_to=companies.models.company_logo_path),
        ),
        migrations.AddField(model_name="company", name="theme_primary", field=models.CharField(default="#123A73", max_length=7)),
        migrations.AddField(model_name="company", name="theme_background", field=models.CharField(default="#0B0D12", max_length=7)),
        migrations.AddField(model_name="company", name="theme_surface", field=models.CharField(default="#141821", max_length=7)),
        migrations.AddField(model_name="company", name="theme_text", field=models.CharField(default="#F4F7FB", max_length=7)),
        migrations.AddField(model_name="company", name="theme_accent", field=models.CharField(default="#2F80ED", max_length=7)),
    ]
