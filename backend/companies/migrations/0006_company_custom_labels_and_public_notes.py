from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("companies", "0005_alter_company_business_type_alter_company_niche")]

    operations = [
        migrations.AddField(
            model_name="company",
            name="business_type_custom",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="company",
            name="niche_custom",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="company",
            name="public_notes",
            field=models.TextField(blank=True, max_length=4000),
        ),
    ]
