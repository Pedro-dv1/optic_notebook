from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("companies", "0006_company_custom_labels_and_public_notes")]

    operations = [
        migrations.AddField(
            model_name="companybookingsettings",
            name="whatsapp_waiting_message",
            field=models.TextField(blank=True, max_length=1000),
        ),
        migrations.AddField(
            model_name="companybookingsettings",
            name="whatsapp_confirmed_message",
            field=models.TextField(blank=True, max_length=1000),
        ),
        migrations.AddField(
            model_name="companybookingsettings",
            name="whatsapp_cancelled_message",
            field=models.TextField(blank=True, max_length=1000),
        ),
    ]
