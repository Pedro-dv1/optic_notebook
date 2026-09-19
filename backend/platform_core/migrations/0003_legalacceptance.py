import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("bookings", "0001_initial"),
        ("companies", "0006_company_custom_labels_and_public_notes"),
        ("platform_core", "0002_alter_registrationkey_options"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="LegalAcceptance",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("document_type", models.CharField(choices=[("TERMS", "Termos de Uso"), ("PRIVACY", "Política de Privacidade")], max_length=16)),
                ("document_version", models.CharField(max_length=32)),
                ("context", models.CharField(choices=[("CUSTOMER_REGISTER", "Cadastro de cliente"), ("COMPANY_REGISTER", "Cadastro de empresa"), ("ANONYMOUS_BOOKING", "Agendamento anônimo"), ("EXISTING_USER_REACCEPTANCE", "Novo aceite de usuário existente")], max_length=40)),
                ("accepted_at", models.DateTimeField(auto_now_add=True, editable=False)),
                ("appointment", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="legal_acceptances", to="bookings.appointment")),
                ("company", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="legal_acceptances", to="companies.company")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="legal_acceptances", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-accepted_at",)},
        ),
        migrations.AddConstraint(
            model_name="legalacceptance",
            constraint=models.CheckConstraint(condition=models.Q(user__isnull=False) | models.Q(company__isnull=False) | models.Q(appointment__isnull=False), name="legal_acceptance_has_subject"),
        ),
        migrations.AddConstraint(
            model_name="legalacceptance",
            constraint=models.UniqueConstraint(condition=models.Q(user__isnull=False), fields=("user", "document_type", "document_version"), name="unique_user_legal_version"),
        ),
        migrations.AddConstraint(
            model_name="legalacceptance",
            constraint=models.UniqueConstraint(condition=models.Q(appointment__isnull=False), fields=("appointment", "document_type", "document_version"), name="unique_booking_legal_version"),
        ),
    ]
