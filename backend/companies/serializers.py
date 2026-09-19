from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from accounts.models import User
from platform_core.legal import record_current_acceptances, validate_legal_acceptance
from platform_core.models import LegalAcceptance, RegistrationKey
from platform_core.turnstile import validate_public_submission
from platform_core.validators import normalize_phone, normalize_tax_identifier, validate_company_slug, validate_image_upload

from .models import BUSINESS_TYPES_BY_NICHE, Company, CompanyBookingSettings


def validate_business_type_for_niche(attrs, instance=None):
    niche = attrs.get("niche", getattr(instance, "niche", None))
    business_type = attrs.get("business_type", getattr(instance, "business_type", None))
    niche_custom = attrs.get("niche_custom", getattr(instance, "niche_custom", ""))
    business_type_custom = attrs.get("business_type_custom", getattr(instance, "business_type_custom", ""))
    if niche and business_type and business_type not in BUSINESS_TYPES_BY_NICHE.get(niche, ()):
        # ASVS V2.2: dependent values are enforced at the API boundary, not only in the browser.
        raise serializers.ValidationError({"business_type": "Escolha um tipo de negócio compatível com o nicho."})
    if niche == Company.Niche.OTHER:
        if not niche_custom.strip():
            raise serializers.ValidationError({"niche_custom": "Informe qual é o nicho da empresa."})
        attrs["niche_custom"] = " ".join(niche_custom.split())
    elif "niche" in attrs or "niche_custom" in attrs:
        attrs["niche_custom"] = ""
    if business_type == Company.BusinessType.OTHER:
        if not business_type_custom.strip():
            raise serializers.ValidationError({"business_type_custom": "Informe qual é o tipo de negócio."})
        attrs["business_type_custom"] = " ".join(business_type_custom.split())
    elif "business_type" in attrs or "business_type_custom" in attrs:
        attrs["business_type_custom"] = ""
    return attrs


class CompanySerializer(serializers.ModelSerializer):
    owner = serializers.UUIDField(source="owner_id", read_only=True)
    city = serializers.CharField(max_length=100)
    state = serializers.ChoiceField(choices=Company.STATE_CHOICES)
    niche_label = serializers.SerializerMethodField()
    business_type_label = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = (
            "id", "owner", "name", "slug", "tax_identifier", "whatsapp", "address",
            "city", "state", "niche", "niche_custom", "niche_label", "business_type",
            "business_type_custom", "business_type_label", "public_notes", "status",
            "created_at", "updated_at", "logo",
        )
        read_only_fields = ("id", "owner", "status", "created_at", "updated_at")

    def validate_whatsapp(self, value):
        return normalize_phone(value)

    def validate_tax_identifier(self, value):
        return normalize_tax_identifier(value)

    def validate_slug(self, value):
        return validate_company_slug(value)

    def validate_city(self, value):
        value = " ".join(value.split())
        if len(value) < 2:
            raise serializers.ValidationError("A cidade deve ter pelo menos 2 caracteres.")
        return value

    def validate(self, attrs):
        if {"niche", "niche_custom", "business_type", "business_type_custom"} & attrs.keys():
            validate_business_type_for_niche(attrs, self.instance)
        return attrs

    def validate_logo(self, value):
        return validate_image_upload(value)

    def get_niche_label(self, obj):
        return obj.niche_custom if obj.niche == Company.Niche.OTHER else obj.get_niche_display()

    def get_business_type_label(self, obj):
        return obj.business_type_custom if obj.business_type == Company.BusinessType.OTHER else obj.get_business_type_display()

class PublicCompanySerializer(serializers.ModelSerializer):
    niche_label = serializers.SerializerMethodField()
    business_type_label = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = (
            "name", "slug", "whatsapp", "address", "city", "state", "niche", "niche_label",
            "business_type", "business_type_label", "public_notes", "status", "logo",
        )

    def get_niche_label(self, obj):
        return obj.niche_custom if obj.niche == Company.Niche.OTHER else obj.get_niche_display()

    def get_business_type_label(self, obj):
        return obj.business_type_custom if obj.business_type == Company.BusinessType.OTHER else obj.get_business_type_display()


class PublicCompanySearchSerializer(serializers.ModelSerializer):
    niche_label = serializers.SerializerMethodField()
    business_type_label = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = (
            "name", "slug", "city", "state", "niche", "niche_label",
            "business_type", "business_type_label", "address", "public_notes", "logo",
        )

    def get_niche_label(self, obj):
        return obj.niche_custom if obj.niche == Company.Niche.OTHER else obj.get_niche_display()

    def get_business_type_label(self, obj):
        return obj.business_type_custom if obj.business_type == Company.BusinessType.OTHER else obj.get_business_type_display()


class PublicCompanySearchQuerySerializer(serializers.Serializer):
    q = serializers.CharField(required=False, allow_blank=True, max_length=150)
    search = serializers.CharField(required=False, allow_blank=True, max_length=150)
    state = serializers.ChoiceField(required=False, choices=Company.STATE_CHOICES)
    city = serializers.CharField(required=False, allow_blank=True, max_length=100)
    niche = serializers.ChoiceField(required=False, choices=Company.Niche.choices)
    business_type = serializers.ChoiceField(required=False, choices=Company.BusinessType.choices)
    service = serializers.CharField(required=False, allow_blank=True, max_length=120)
    ordering = serializers.ChoiceField(required=False, choices=("name", "-name"), default="name")
    page = serializers.IntegerField(required=False, min_value=1)
    page_size = serializers.IntegerField(required=False, min_value=1, max_value=48)


class CompanyViewSerializer(serializers.Serializer):
    visitor_id = serializers.RegexField(r"^[A-Za-z0-9_-]{20,64}$", max_length=64)


class PlatformCompanySerializer(CompanySerializer):
    appointments_this_month = serializers.IntegerField(read_only=True)
    appointments_previous_month = serializers.IntegerField(read_only=True)
    total_appointments = serializers.IntegerField(read_only=True)
    views_this_month = serializers.IntegerField(read_only=True)
    views_previous_month = serializers.IntegerField(read_only=True)
    total_views = serializers.IntegerField(read_only=True)
    unique_visitors_this_month = serializers.IntegerField(read_only=True)
    unique_visitors_previous_month = serializers.IntegerField(read_only=True)

    class Meta(CompanySerializer.Meta):
        fields = CompanySerializer.Meta.fields + (
            "appointments_this_month", "appointments_previous_month", "total_appointments",
            "views_this_month", "views_previous_month", "total_views",
            "unique_visitors_this_month", "unique_visitors_previous_month",
        )


class CompanyRegistrationSerializer(serializers.Serializer):
    authorization_key = serializers.CharField(write_only=True, min_length=40, max_length=100)
    owner_email = serializers.EmailField(write_only=True)
    owner_password = serializers.CharField(write_only=True, min_length=12, max_length=128, trim_whitespace=False)
    owner_name = serializers.CharField(write_only=True, max_length=150)
    owner_whatsapp = serializers.CharField(write_only=True, max_length=20)
    name = serializers.CharField(max_length=150)
    slug = serializers.SlugField(max_length=80)
    tax_identifier = serializers.CharField(max_length=18, required=False, allow_blank=True)
    whatsapp = serializers.CharField(max_length=20)
    address = serializers.CharField(max_length=300, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100)
    state = serializers.ChoiceField(choices=Company.STATE_CHOICES)
    niche = serializers.ChoiceField(choices=Company.Niche.choices)
    niche_custom = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    business_type = serializers.ChoiceField(choices=Company.BusinessType.choices)
    business_type_custom = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    public_notes = serializers.CharField(max_length=4000, required=False, allow_blank=True, default="")
    turnstile_token = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=2048)
    website = serializers.CharField(write_only=True, required=False, allow_blank=True, max_length=200)
    terms_accepted = serializers.BooleanField(write_only=True, required=False, default=False)
    privacy_accepted = serializers.BooleanField(write_only=True, required=False, default=False)

    def validate_owner_email(self, value):
        return User.objects.normalize_email(value).lower()

    def validate_owner_whatsapp(self, value):
        return normalize_phone(value) if value else ""

    def validate_whatsapp(self, value):
        return normalize_phone(value)

    def validate_tax_identifier(self, value):
        return normalize_tax_identifier(value)

    def validate_slug(self, value):
        return validate_company_slug(value)

    def validate_city(self, value):
        value = " ".join(value.split())
        if len(value) < 2:
            raise serializers.ValidationError("A cidade deve ter pelo menos 2 caracteres.")
        return value

    def validate(self, attrs):
        validate_public_submission(attrs, self.context, "company_registration")
        self.legal_document_types = validate_legal_acceptance(attrs)
        validate_business_type_for_niche(attrs)
        candidate = User(email=attrs["owner_email"], full_name=attrs["owner_name"])
        validate_password(attrs["owner_password"], candidate)
        return attrs

    def create(self, validated_data):
        secret = validated_data.pop("authorization_key")
        digest = RegistrationKey.digest_secret(secret)
        owner_data = {
            "email": validated_data.pop("owner_email"),
            "password": validated_data.pop("owner_password"),
            "full_name": validated_data.pop("owner_name"),
            "whatsapp": validated_data.pop("owner_whatsapp", ""),
        }
        try:
            with transaction.atomic():
                key = RegistrationKey.objects.select_for_update().filter(digest=digest).first()
                if not key or not key.is_active or key.consumed_at:
                    raise serializers.ValidationError({"authorization_key": "A chave de autorização é inválida ou já foi usada."})
                if User.objects.filter(email=owner_data["email"]).exists():
                    raise serializers.ValidationError({"owner_email": "Este e-mail já está cadastrado."})
                owner = User.objects.create_user(**owner_data)
                company = Company.objects.create(owner=owner, **validated_data)
                CompanyBookingSettings.objects.create(company=company)
                record_current_acceptances(
                    self.legal_document_types,
                    context=LegalAcceptance.Context.COMPANY_REGISTER,
                    user=owner,
                    company=company,
                )
                key.consumed_at = timezone.now()
                key.consumed_by_company = company
                key.is_active = False
                key.save(update_fields=("consumed_at", "consumed_by_company", "is_active", "updated_at"))
                return company
        except IntegrityError as exc:
            raise serializers.ValidationError("Já existe uma conta ou empresa com um dos dados informados.") from exc


class CompanyBookingSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyBookingSettings
        fields = (
            "late_tolerance", "minimum_change_notice", "whatsapp_waiting_message",
            "whatsapp_confirmed_message", "whatsapp_cancelled_message", "updated_at",
        )
        read_only_fields = ("updated_at",)

    def validate_late_tolerance(self, value):
        if value.total_seconds() > 86_400:
            raise serializers.ValidationError("A tolerância não pode exceder um dia.")
        return value

    def validate_minimum_change_notice(self, value):
        if value.total_seconds() > 31_536_000:
            raise serializers.ValidationError("O prazo mínimo não pode exceder um ano.")
        return value
