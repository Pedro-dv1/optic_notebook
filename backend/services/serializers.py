from rest_framework import serializers
from professionals.models import Professional

from .models import Service


class ServiceAdminSerializer(serializers.ModelSerializer):
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
            "professional_ids", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        company = self.context.get("company")
        if company:
            field = self.fields["professional_ids"].child_relation
            field.queryset = Professional.objects.filter(company=company)
            field.error_messages["does_not_exist"] = "Selecione um profissional válido desta empresa."
            field.error_messages["incorrect_type"] = "Selecione um profissional válido."

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
    class Meta:
        model = Service
        fields = ("id", "name", "description", "price", "duration", "slot_interval")
