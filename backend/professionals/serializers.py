from rest_framework import serializers

from services.models import Service

from .models import Professional, WorkSchedule


class ProfessionalAdminSerializer(serializers.ModelSerializer):
    service_ids = serializers.PrimaryKeyRelatedField(
        source="services",
        many=True,
        queryset=Service.objects.none(),
        required=False,
    )

    class Meta:
        model = Professional
        fields = ("id", "name", "is_active", "service_ids", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        company = self.context.get("company")
        if company:
            field = self.fields["service_ids"].child_relation
            field.queryset = Service.objects.filter(company=company)
            field.error_messages["does_not_exist"] = "Selecione um serviço válido desta empresa."
            field.error_messages["incorrect_type"] = "Selecione um serviço válido."


class PublicProfessionalSerializer(serializers.ModelSerializer):
    service_ids = serializers.SerializerMethodField()

    class Meta:
        model = Professional
        fields = ("id", "name", "service_ids")

    def get_service_ids(self, obj):
        return [service.id for service in obj.services.all() if service.company_id == obj.company_id and service.is_active]


class PublicProfessionalQuerySerializer(serializers.Serializer):
    service = serializers.UUIDField(required=False)


class WorkScheduleSerializer(serializers.ModelSerializer):
    professional = serializers.PrimaryKeyRelatedField(queryset=Professional.objects.none())

    class Meta:
        model = WorkSchedule
        fields = ("id", "professional", "weekday", "starts_at", "ends_at", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        company = self.context.get("company")
        if company:
            self.fields["professional"].queryset = Professional.objects.filter(company=company)

    def validate(self, attrs):
        professional = attrs.get("professional", getattr(self.instance, "professional", None))
        weekday = attrs.get("weekday", getattr(self.instance, "weekday", None))
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts_at and ends_at and starts_at >= ends_at:
            raise serializers.ValidationError("O horário inicial deve ser anterior ao final.")
        if all(value is not None for value in (professional, weekday, starts_at, ends_at)):
            overlapping = WorkSchedule.objects.filter(
                professional=professional,
                weekday=weekday,
                starts_at__lt=ends_at,
                ends_at__gt=starts_at,
            )
            if self.instance:
                overlapping = overlapping.exclude(pk=self.instance.pk)
            if overlapping.exists():
                raise serializers.ValidationError("Este horário se sobrepõe a outro já cadastrado.")
        return attrs
