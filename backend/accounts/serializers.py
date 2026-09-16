from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from platform_core.permissions import company_for_user
from platform_core.turnstile import validate_public_submission
from platform_core.validators import normalize_phone, validate_image_upload

from .models import User


class UserSerializer(serializers.ModelSerializer):
    company = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "full_name", "whatsapp", "avatar", "is_superuser", "company")
        read_only_fields = ("id", "email", "is_superuser", "company")

    def get_company(self, obj):
        company = company_for_user(obj)
        if not company:
            return None
        return {"id": company.id, "name": company.name, "slug": company.slug, "status": company.status}

    def validate_whatsapp(self, value):
        return normalize_phone(value) if value else ""


class CustomerProfileSerializer(serializers.ModelSerializer):
    avatar = serializers.FileField(required=False, allow_null=True)
    full_name = serializers.CharField(min_length=2, max_length=150)

    class Meta:
        model = User
        fields = ("id", "email", "full_name", "whatsapp", "avatar")
        read_only_fields = ("id", "email")

    def validate_full_name(self, value):
        return " ".join(value.split())

    def validate_whatsapp(self, value):
        return normalize_phone(value) if value else ""

    def validate_avatar(self, value):
        return validate_image_upload(value) if value else None

    def update(self, instance, validated_data):
        previous_name = instance.avatar.name if instance.avatar else ""
        previous_storage = instance.avatar.storage if instance.avatar else None
        updated = super().update(instance, validated_data)
        current_name = updated.avatar.name if updated.avatar else ""
        if previous_name and previous_name != current_name and previous_storage:
            # ASVS V5.3: delete only the exact storage-managed name after the database update commits.
            transaction.on_commit(lambda: previous_storage.delete(previous_name))
        return updated


class OtpVerificationSerializer(serializers.Serializer):
    challenge_id = serializers.UUIDField()
    code = serializers.RegexField(r"^\d{6}$", write_only=True)


class AccountActionRequestSerializer(serializers.Serializer):
    pass


class AuthorizationSerializer(serializers.Serializer):
    authorization_token = serializers.CharField(write_only=True, min_length=32, max_length=128, trim_whitespace=False)


class CustomerPasswordChangeSerializer(AuthorizationSerializer):
    new_password = serializers.CharField(write_only=True, min_length=12, max_length=128, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, min_length=12, max_length=128, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "As novas senhas não coincidem."})
        user = self.context["request"].user
        if user.check_password(attrs["new_password"]):
            raise serializers.ValidationError({"new_password": "A nova senha deve ser diferente da senha atual."})
        validate_password(attrs["new_password"], user)
        return attrs



class NewEmailRequestSerializer(AuthorizationSerializer):
    new_email = serializers.EmailField(max_length=254)

    def validate_new_email(self, value):
        return User.objects.normalize_email(value).lower()


class NewEmailVerificationSerializer(OtpVerificationSerializer, AuthorizationSerializer):
    pass


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    turnstile_token = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=2048)
    website = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=200)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["auth_version"] = user.auth_version
        return token

    def validate(self, attrs):
        validate_public_submission(attrs, self.context, "login")
        attrs[self.username_field] = User.objects.normalize_email(attrs[self.username_field]).strip().lower()
        # ASVS V6.3: authentication stays on Django/SimpleJWT and keeps a generic credential failure.
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user, context=self.context).data
        return data


class LogoutSerializer(serializers.Serializer):
    pass


class CustomerRegistrationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(validators=[])
    password = serializers.CharField(write_only=True, min_length=12, max_length=128, trim_whitespace=False)
    whatsapp = serializers.CharField(max_length=20)
    turnstile_token = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=2048)
    website = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=200)

    class Meta:
        model = User
        fields = ("id", "email", "password", "full_name", "whatsapp", "turnstile_token", "website")
        read_only_fields = ("id",)

    def validate_email(self, value):
        value = User.objects.normalize_email(value).lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Este e-mail já está cadastrado.")
        return value

    def validate_whatsapp(self, value):
        return normalize_phone(value) if value else ""

    def validate(self, attrs):
        validate_public_submission(attrs, self.context, "customer_registration")
        candidate = User(email=attrs.get("email", ""), full_name=attrs.get("full_name", ""))
        validate_password(attrs["password"], candidate)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        try:
            with transaction.atomic():
                return User.objects.create_user(password=password, **validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError("Este e-mail já está cadastrado.") from exc
