from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError, transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from platform_core.permissions import company_for_user
from platform_core.legal import record_current_acceptances, validate_legal_acceptance
from platform_core.models import LegalAcceptance
from platform_core.turnstile import validate_public_submission
from platform_core.validators import normalize_phone, validate_image_upload

from .models import User


class UserSerializer(serializers.ModelSerializer):
    company = serializers.SerializerMethodField()
    professional = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "full_name", "whatsapp", "avatar", "notification_preference", "is_superuser", "company", "professional", "role")
        read_only_fields = ("id", "email", "is_superuser", "company", "professional", "role")

    def get_company(self, obj):
        company = company_for_user(obj)
        if not company:
            return None
        return {"id": company.id, "name": company.name, "slug": company.slug, "status": company.status}

    def validate_whatsapp(self, value):
        return normalize_phone(value) if value else ""

    def get_professional(self, obj):
        from platform_core.permissions import professional_for_user

        professional = professional_for_user(obj)
        if not professional:
            return None
        return {
            "id": professional.id,
            "name": professional.name,
            "company": professional.company_id,
            "company_name": professional.company.name,
            "company_slug": professional.company.slug,
        }

    def get_role(self, obj):
        if obj.is_superuser:
            return "platform"
        if self.get_company(obj):
            return "company"
        if self.get_professional(obj):
            return "professional"
        return "customer"


class CustomerProfileSerializer(serializers.ModelSerializer):
    avatar = serializers.FileField(required=False, allow_null=True)
    full_name = serializers.CharField(min_length=2, max_length=150)
    notification_preference = serializers.BooleanField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = ("id", "email", "full_name", "whatsapp", "avatar", "notification_preference")
        read_only_fields = ("id", "email")

    def validate_full_name(self, value):
        return " ".join(value.split())

    def validate_whatsapp(self, value):
        return normalize_phone(value) if value else ""

    def validate_avatar(self, value):
        return validate_image_upload(value, max_dimension=512, max_input_dimension=4096) if value else None

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
    email = serializers.EmailField(required=False, max_length=254)


class AuthorizationSerializer(serializers.Serializer):
    authorization_token = serializers.CharField(write_only=True, min_length=32, max_length=128, trim_whitespace=False)


class CustomerPasswordChangeSerializer(AuthorizationSerializer):
    new_password = serializers.CharField(write_only=True, min_length=12, max_length=128, trim_whitespace=False)
    new_password_confirm = serializers.CharField(write_only=True, min_length=12, max_length=128, trim_whitespace=False)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "As novas senhas não coincidem."})
        user = self.context.get("password_user", self.context["request"].user)
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


class AccountDeletionSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True, max_length=128, trim_whitespace=False)
    confirmation = serializers.ChoiceField(choices=("EXCLUIR",))

    def validate(self, attrs):
        if set(self.initial_data) - {"password", "confirmation"}:
            raise serializers.ValidationError("A exclusão aceita somente os dados de confirmação da própria conta.")
        return attrs


class CustomerRegistrationSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(validators=[])
    password = serializers.CharField(write_only=True, min_length=12, max_length=128, trim_whitespace=False)
    whatsapp = serializers.CharField(max_length=20)
    turnstile_token = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=2048)
    website = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=200)
    terms_accepted = serializers.BooleanField(write_only=True, required=False, default=False)
    privacy_accepted = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = User
        fields = (
            "id", "email", "password", "full_name", "whatsapp", "turnstile_token", "website",
            "terms_accepted", "privacy_accepted",
        )
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
        self.legal_document_types = validate_legal_acceptance(attrs)
        candidate = User(email=attrs.get("email", ""), full_name=attrs.get("full_name", ""))
        validate_password(attrs["password"], candidate)
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        try:
            with transaction.atomic():
                user = User.objects.create_user(password=password, **validated_data)
                record_current_acceptances(
                    self.legal_document_types,
                    context=LegalAcceptance.Context.CUSTOMER_REGISTER,
                    user=user,
                )
                return user
        except IntegrityError as exc:
            raise serializers.ValidationError("Este e-mail já está cadastrado.") from exc


class ProfessionalRegistrationSerializer(serializers.Serializer):
    full_name = serializers.CharField(min_length=2, max_length=150)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, min_length=12, max_length=128, trim_whitespace=False)
    access_key = serializers.RegexField(r"^[A-Z2-9]{12}$", write_only=True)
    turnstile_token = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=2048)
    website = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=200)
    terms_accepted = serializers.BooleanField(write_only=True, required=False, default=False)
    privacy_accepted = serializers.BooleanField(write_only=True, required=False, default=False)

    def validate(self, attrs):
        validate_public_submission(attrs, self.context, "professional_registration")
        self.legal_document_types = validate_legal_acceptance(attrs)
        attrs["email"] = User.objects.normalize_email(attrs["email"]).lower()
        attrs["full_name"] = " ".join(attrs["full_name"].split())
        validate_password(attrs["password"], User(email=attrs["email"], full_name=attrs["full_name"]))
        return attrs

    def create(self, validated_data):
        from django.utils import timezone
        from professionals.models import ProfessionalAccessInvite

        digest = ProfessionalAccessInvite.digest_secret(validated_data.pop("access_key"))
        password = validated_data.pop("password")
        validated_data.pop("turnstile_token", None)
        validated_data.pop("website", None)
        try:
            # ASVS v5.0.0-2.3.3/2.3.4: lock makes invitation consumption atomic and single-use.
            with transaction.atomic():
                invite = ProfessionalAccessInvite.objects.select_for_update().select_related("professional", "company").filter(digest=digest).first()
                if (
                    not invite or invite.used_at or invite.revoked_at or invite.expires_at <= timezone.now()
                    or invite.professional.user_id or User.objects.filter(email=validated_data["email"]).exists()
                ):
                    raise serializers.ValidationError({"access_key": "A chave ou os dados informados são inválidos."})
                user = User.objects.create_user(password=password, **validated_data)
                invite.professional.user = user
                invite.professional.access_active = True
                invite.professional.save(update_fields=("user", "access_active", "updated_at"))
                invite.used_at = timezone.now()
                invite.save(update_fields=("used_at", "updated_at"))
                record_current_acceptances(
                    self.legal_document_types,
                    context=LegalAcceptance.Context.PROFESSIONAL_REGISTER,
                    user=user,
                    company=invite.company,
                )
                return user
        except IntegrityError as exc:
            raise serializers.ValidationError({"access_key": "A chave ou os dados informados são inválidos."}) from exc
