from rest_framework import serializers
from django.utils import timezone

from services.models import Service
from companies.models import CompanyUnit

from .models import Professional, ProfessionalAccessInvite, ProfessionalUnavailability, WorkSchedule


class ProfessionalAdminSerializer(serializers.ModelSerializer):
    unit_ids = serializers.PrimaryKeyRelatedField(source="units", many=True, queryset=CompanyUnit.objects.none(), required=False)
    service_ids = serializers.PrimaryKeyRelatedField(
        source="services",
        many=True,
        queryset=Service.objects.none(),
        required=False,
    )
    access_email = serializers.EmailField(source="user.email", read_only=True)
    invite_state = serializers.SerializerMethodField()

    class Meta:
        model = Professional
        fields = (
            "id", "name", "is_active", "service_ids", "unit_ids", "access_active", "access_email",
            "invite_state", "created_at", "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        company = self.context.get("company")
        if company:
            self.fields["unit_ids"].child_relation.queryset = CompanyUnit.objects.filter(company=company)
            field = self.fields["service_ids"].child_relation
            field.queryset = Service.objects.filter(company=company)
            field.error_messages["does_not_exist"] = "Selecione um serviço válido desta empresa."
            field.error_messages["incorrect_type"] = "Selecione um serviço válido."

    def validate(self, attrs):
        if "units" in attrs and self.instance:
            ids = [unit.id for unit in attrs["units"]]
            if self.instance.work_schedules.exclude(unit_id__in=ids).exists():
                raise serializers.ValidationError({"unit_ids": "Remova as jornadas desta unidade antes de desvincular o profissional."})
            if self.instance.appointments.filter(starts_at__gte=timezone.now()).exclude(unit_id__in=ids).exclude(status="CANCELLED").exists():
                raise serializers.ValidationError({"unit_ids": "Há agendamentos futuros nesta unidade."})
        return attrs

    def get_invite_state(self, obj):
        invite = next(iter(obj.access_invites.all()), None)
        return invite.state if invite else None


class PublicProfessionalSerializer(serializers.ModelSerializer):
    service_ids = serializers.SerializerMethodField()
    unit_ids = serializers.PrimaryKeyRelatedField(source="units", many=True, read_only=True)

    class Meta:
        model = Professional
        fields = ("id", "name", "service_ids", "unit_ids")

    def get_service_ids(self, obj):
        return [service.id for service in obj.services.all() if service.company_id == obj.company_id and service.is_active]


class PublicProfessionalQuerySerializer(serializers.Serializer):
    service = serializers.UUIDField(required=False)
    unit = serializers.UUIDField(required=False)


class WorkScheduleSerializer(serializers.ModelSerializer):
    professional = serializers.PrimaryKeyRelatedField(queryset=Professional.objects.none())
    unit = serializers.PrimaryKeyRelatedField(queryset=CompanyUnit.objects.none(), required=False)

    class Meta:
        model = WorkSchedule
        fields = ("id", "professional", "unit", "weekday", "starts_at", "ends_at", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        company = self.context.get("company")
        if company:
            self.fields["professional"].queryset = Professional.objects.filter(company=company)
            self.fields["unit"].queryset = CompanyUnit.objects.filter(company=company, is_active=True)

    def validate(self, attrs):
        professional = attrs.get("professional", getattr(self.instance, "professional", None))
        weekday = attrs.get("weekday", getattr(self.instance, "weekday", None))
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        unit = attrs.get("unit", getattr(self.instance, "unit", None))
        if professional:
            if not unit:
                units = list(professional.units.filter(is_active=True)[:2])
                if len(units) != 1:
                    raise serializers.ValidationError({"unit": "Selecione a unidade da jornada."})
                unit = attrs["unit"] = units[0]
            if not professional.units.filter(pk=unit.pk).exists():
                raise serializers.ValidationError({"unit": "O profissional não está vinculado a esta unidade."})
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


class ProfessionalUnavailabilitySerializer(serializers.ModelSerializer):
    allow_conflicts = serializers.BooleanField(write_only=True, required=False, default=False)
    conflict_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = ProfessionalUnavailability
        fields = (
            "id", "professional", "starts_at", "ends_at", "kind", "reason", "allow_conflicts",
            "conflict_count", "created_at", "updated_at",
        )
        read_only_fields = ("id", "conflict_count", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        company = self.context.get("company")
        self.fields["professional"].queryset = Professional.objects.filter(company=company) if company else Professional.objects.none()

    def validate(self, attrs):
        starts_at = attrs.get("starts_at", getattr(self.instance, "starts_at", None))
        ends_at = attrs.get("ends_at", getattr(self.instance, "ends_at", None))
        if starts_at and ends_at and starts_at >= ends_at:
            raise serializers.ValidationError("O início deve ser anterior ao fim.")
        return attrs


class ProfessionalAccessInviteSerializer(serializers.ModelSerializer):
    state = serializers.CharField(read_only=True)

    class Meta:
        model = ProfessionalAccessInvite
        fields = ("id", "state", "expires_at", "created_at", "used_at", "revoked_at")
        read_only_fields = fields
