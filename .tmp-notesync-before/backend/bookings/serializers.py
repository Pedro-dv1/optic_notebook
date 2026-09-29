from urllib.parse import urlparse

from django.conf import settings
from rest_framework import serializers
from django.utils import timezone

from accounts.models import User
from platform_core.validators import normalize_phone
from platform_core.turnstile import validate_public_submission

from .models import Appointment, Review
from .messaging import appointment_whatsapp_message


class AppointmentSerializer(serializers.ModelSerializer):
    unit_name = serializers.CharField(source="unit.name", read_only=True, default="")
    unit_address = serializers.CharField(source="unit.address", read_only=True, default="")
    unit_city = serializers.CharField(source="unit.city", read_only=True, default="")
    unit_state = serializers.CharField(source="unit.state", read_only=True, default="")
    company_name = serializers.CharField(source="company.name", read_only=True)
    company_slug = serializers.CharField(source="company.slug", read_only=True)
    company_logo = serializers.ImageField(source="company.logo", read_only=True)
    company_address = serializers.CharField(source="company.address", read_only=True)
    company_city = serializers.CharField(source="company.city", read_only=True)
    company_state = serializers.CharField(source="company.state", read_only=True)
    service_name = serializers.CharField(source="service.name", read_only=True)
    professional_name = serializers.CharField(source="professional.name", read_only=True)
    customer_avatar = serializers.SerializerMethodField()
    can_cancel = serializers.SerializerMethodField()
    can_reschedule = serializers.SerializerMethodField()
    whatsapp_message = serializers.SerializerMethodField()
    late_status = serializers.SerializerMethodField()
    can_record_outcome = serializers.SerializerMethodField()
    reviewed = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = (
            "id", "unit", "unit_name", "unit_address", "unit_city", "unit_state", "cancellation_reason", "company", "company_name", "company_slug", "company_logo", "company_address", "company_city",
            "company_state", "service", "service_name", "professional", "professional_name",
            "starts_at", "ends_at", "customer_name", "customer_email", "customer_whatsapp",
            "customer_notes", "customer_avatar", "status", "can_cancel", "can_reschedule", "whatsapp_message",
            "outcome", "outcome_recorded_at", "origin", "late_status", "can_record_outcome", "reviewed",
            "created_at", "updated_at",
        )
        read_only_fields = fields

    def _can_change(self, obj):
        if obj.outcome:
            return False
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

    def get_late_status(self, obj):
        now = timezone.now()
        if obj.status != Appointment.Status.CONFIRMED or obj.outcome or now < obj.starts_at:
            return None
        return "WITHIN_TOLERANCE" if now <= obj.starts_at + obj.company.booking_settings.late_tolerance else "EXCEEDED"

    def get_can_record_outcome(self, obj):
        return obj.status == Appointment.Status.CONFIRMED and not obj.outcome and obj.ends_at <= timezone.now()

    def get_reviewed(self, obj):
        try:
            obj.review
            return True
        except Review.DoesNotExist:
            return False


class AppointmentCreateSerializer(serializers.Serializer):
    unit = serializers.UUIDField(required=False)
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


class ManualAppointmentCreateSerializer(AppointmentCreateSerializer):
    def validate(self, attrs):
        return attrs

    def customer_snapshot(self, user=None):
        missing = [field for field in ("customer_name", "customer_email", "customer_whatsapp") if not self.validated_data.get(field)]
        if missing:
            raise serializers.ValidationError({field: "Este campo é obrigatório." for field in missing})
        return {
            "customer_name": self.validated_data["customer_name"],
            "customer_email": self.validated_data["customer_email"],
            "customer_whatsapp": self.validated_data["customer_whatsapp"],
            "customer_notes": self.validated_data.get("customer_notes", ""),
        }


class UnitQuerySerializer(serializers.Serializer):
    unit = serializers.UUIDField(required=False)


class AvailabilityQuerySerializer(UnitQuerySerializer):
    service = serializers.UUIDField()
    date = serializers.DateField()
    professional = serializers.UUIDField(required=False)


class AppointmentPeriodSerializer(serializers.Serializer):
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)

    def validate(self, attrs):
        start, end = attrs.get("start_date"), attrs.get("end_date")
        if bool(start) != bool(end) or (start and (end < start or (end - start).days > 62)):
            raise serializers.ValidationError("Informe um período válido de até 63 dias.")
        return attrs


class AvailabilityDaysQuerySerializer(UnitQuerySerializer):
    service = serializers.UUIDField()
    professional = serializers.UUIDField(required=False)
    start_date = serializers.DateField()
    end_date = serializers.DateField()

    def validate(self, attrs):
        if attrs["end_date"] < attrs["start_date"] or (attrs["end_date"] - attrs["start_date"]).days > 30:
            raise serializers.ValidationError("Consulte no máximo 31 dias por vez.")
        return attrs


class ManagementTokenSerializer(serializers.Serializer):
    management_token = serializers.CharField(min_length=40, max_length=100, write_only=True)


class RescheduleSerializer(ManagementTokenSerializer):
    starts_at = serializers.DateTimeField()


class CustomerRescheduleSerializer(serializers.Serializer):
    starts_at = serializers.DateTimeField()


class AppointmentOutcomeSerializer(serializers.Serializer):
    outcome = serializers.ChoiceField(choices=Appointment.Outcome.choices)


class PushSubscriptionSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=2048)
    p256dh = serializers.CharField(min_length=40, max_length=256, trim_whitespace=False)
    auth = serializers.CharField(min_length=16, max_length=128, trim_whitespace=False)
    appointment = serializers.UUIDField()
    management_token = serializers.CharField(min_length=40, max_length=100, write_only=True, required=False)

    def validate_endpoint(self, value):
        hostname = (urlparse(value).hostname or "").lower()
        allowed = any(hostname == suffix or hostname.endswith(f".{suffix}") for suffix in settings.WEB_PUSH_ALLOWED_HOST_SUFFIXES)
        # ASVS v5.0.0-1.3.6: the backend only contacts configured Web Push provider domains.
        if not value.startswith("https://") or not allowed:
            raise serializers.ValidationError("O endpoint deve usar HTTPS.")
        return value


class ReviewCreateSerializer(serializers.ModelSerializer):
    review_token = serializers.CharField(min_length=40, max_length=100, write_only=True, required=False)

    class Meta:
        model = Review
        fields = ("id", "rating", "comment", "review_token", "created_at")
        read_only_fields = ("id", "created_at")


class ReviewSerializer(serializers.ModelSerializer):
    verified = serializers.BooleanField(read_only=True, default=True)
    customer_name = serializers.CharField(source="appointment.customer_name", read_only=True)

    class Meta:
        model = Review
        fields = (
            "id", "appointment", "rating", "comment", "company_response", "responded_at",
            "customer_name", "verified", "created_at", "updated_at",
        )
        read_only_fields = fields


class ReviewResponseSerializer(serializers.Serializer):
    company_response = serializers.CharField(max_length=2000, allow_blank=True)


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
