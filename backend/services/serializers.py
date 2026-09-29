from rest_framework import serializers
from professionals.models import Professional
from companies.models import CompanyUnit
from companies.serializers import validate_catalog_membership
from django.utils import timezone

from .models import Service


class ServiceAdminSerializer(serializers.ModelSerializer):
    unit_ids = serializers.PrimaryKeyRelatedField(source="units", many=True, queryset=CompanyUnit.objects.none(), required=False)
    professional_ids = serializers.PrimaryKeyRelatedField(
        source="professionals",
        many=True,
        queryset=Professional.objects.none(),
        required=False,
    )

    class Meta:
        model = Service
        fields = (
            "id", "name", "description", "price", "duration", "slot_interval", "is_active",
            "professional_ids", "unit_ids", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        company = self.context.get("company")
        if company:
            self.fields["unit_ids"].child_relation.queryset = CompanyUnit.objects.filter(company=company)
            field = self.fields["professional_ids"].child_relation
            field.queryset = Professional.objects.filter(company=company)
            field.error_messages["does_not_exist"] = "Selecione um profissional válido desta empresa."
            field.error_messages["incorrect_type"] = "Selecione um profissional válido."

    def validate(self, attrs):
        ids = validate_catalog_membership(attrs, self.instance, self.context["company"], "professionals", "professional_ids")
        if self.instance and "units" in attrs:
            if self.instance.appointments.filter(starts_at__gte=timezone.now()).exclude(unit_id__in=ids).exclude(status="CANCELLED").exists():
                raise serializers.ValidationError({"unit_ids": "Há agendamentos futuros nesta unidade."})
        return attrs

    def validate_duration(self, value):
        if value.total_seconds() > 86_400:
            raise serializers.ValidationError("A duração não pode exceder um dia.")
        if value.total_seconds() % 60:
            raise serializers.ValidationError("A duração deve usar minutos inteiros.")
        return value

    def validate_slot_interval(self, value):
        if value.total_seconds() > 86_400:
            raise serializers.ValidationError("O intervalo não pode exceder um dia.")
        if value.total_seconds() % 60:
            raise serializers.ValidationError("O intervalo deve usar minutos inteiros.")
        return value


class PublicServiceSerializer(serializers.ModelSerializer):
    unit_ids = serializers.PrimaryKeyRelatedField(source="units", many=True, read_only=True)
    class Meta:
        model = Service
        fields = ("id", "name", "description", "price", "duration", "slot_interval", "unit_ids")
