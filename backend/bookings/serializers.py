from rest_framework import serializers
from django.utils import timezone

from accounts.models import User
from platform_core.validators import normalize_phone
from platform_core.turnstile import validate_public_submission

from .models import Appointment
from .messaging import appointment_whatsapp_message


class AppointmentSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source="company.name", read_only=True)
    company_slug = serializers.CharField(source="company.slug", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)
    professional_name = serializers.CharField(source="professional.name", read_only=True)
    customer_avatar = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()
    can_reschedule = serializers.SerializerMethodField()
    whatsapp_message = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = (
            "id", "company", "company_name", "company_slug", "service", "service_name", "professional", "professional_name",
            "starts_at", "ends_at", "customer_name", "customer_email", "customer_whatsapp",
            "customer_notes", "customer_avatar", "status", "can_cancel", "can_reschedule", "whatsapp_message",
            "created_at", "updated_at",
        )
        read_only_fields = fields

    def _can_change(self, obj):
        if obj.status not in (Appointment.Status.WAITING_CONFIRMATION, Appointment.Status.CONFIRMED):
            return False
        return timezone.now() <= obj.starts_at - obj.company.booking_settings.minimum_change_notice

    def get_can_cancel(self, obj):
        return self._can_change(obj)

    def get_can_reschedule(self, obj):
        return self._can_change(obj)

    def get_customer_avatar(self, obj):
        if not obj.customer or not obj.customer.avatar:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.customer.avatar.url) if request else obj.customer.avatar.url

    def get_whatsapp_message(self, obj):
        return appointment_whatsapp_message(obj)


class AppointmentCreateSerializer(serializers.Serializer):
    service = serializers.UUIDField()
    professional = serializers.UUIDField()
    starts_at = serializers.DateTimeField()
    customer_name = serializers.CharField(max_length=150, required=False)
    customer_email = serializers.EmailField(required=False)
    customer_whatsapp = serializers.CharField(max_length=20, required=False)
    customer_notes = serializers.CharField(max_length=2000, required=False, allow_blank=True, default="")
    turnstile_token = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=2048)
    website = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=200)

    def validate(self, attrs):
        request = self.context.get("request")
        validate_public_submission(
            attrs,
            self.context,
            "anonymous_booking",
            required=not request or not request.user.is_authenticated,
        )
        return attrs

    def validate_customer_email(self, value):
        return User.objects.normalize_email(value).lower()

    def validate_customer_whatsapp(self, value):
        return normalize_phone(value)

    def customer_snapshot(self, user):
        data = self.validated_data
        if user.is_authenticated:
            name = data.get("customer_name", user.full_name)
            email = data.get("customer_email", user.email)
            whatsapp = data.get("customer_whatsapp", user.whatsapp)
        else:
            missing = [
                field
                for field in ("customer_name", "customer_email", "customer_whatsapp")
                if not data.get(field)
            ]
            if missing:
                raise serializers.ValidationError({field: "Este campo é obrigatório." for field in missing})
            name = data["customer_name"]
            email = data["customer_email"]
            whatsapp = data["customer_whatsapp"]
        if not name or not email or not whatsapp:
            raise serializers.ValidationError("Seus dados salvos estão incompletos. Informe os dados deste agendamento.")
        return {
            "customer_name": name,
            "customer_email": email,
            "customer_whatsapp": whatsapp,
            "customer_notes": data.get("customer_notes", ""),
        }


class AvailabilityQuerySerializer(serializers.Serializer):
    service = serializers.UUIDField()
    date = serializers.DateField()
    professional = serializers.UUIDField(required=False)


class ManagementTokenSerializer(serializers.Serializer):
    management_token = serializers.CharField(min_length=40, max_length=100, write_only=True)


class RescheduleSerializer(ManagementTokenSerializer):
    starts_at = serializers.DateTimeField()


class CustomerRescheduleSerializer(serializers.Serializer):
    starts_at = serializers.DateTimeField()


class CompanyCustomerSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="customer_name", read_only=True)
    email = serializers.EmailField(source="customer_email", read_only=True)
    whatsapp = serializers.CharField(source="customer_whatsapp", read_only=True)
    last_appointment_at = serializers.DateTimeField(source="starts_at", read_only=True)
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = ("name", "email", "whatsapp", "avatar", "last_appointment_at")

    def get_avatar(self, obj):
        if not obj.customer or not obj.customer.avatar:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.customer.avatar.url) if request else obj.customer.avatar.url
