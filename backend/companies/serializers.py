from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import serializers

from accounts.models import User
from platform_core.legal import record_current_acceptances, validate_legal_acceptance
from platform_core.models import LegalAcceptance, RegistrationKey
from platform_core.turnstile import validate_public_submission
from platform_core.validators import normalize_phone, normalize_tax_identifier, validate_company_slug, validate_image_upload

from .models import BUSINESS_TYPES_BY_NICHE, Company, CompanyBookingSettings, CompanyUnit


def validate_catalog_membership(attrs, instance, company, related_name, related_field):
    """Keep the existing explicit memberships; an empty list is never global."""
    units = attrs.get("units")
    if units is None:
        if instance:
            units = list(instance.units.all())
        else:
            units = list(company.units.filter(is_active=True)[:2])
            if len(units) != 1:
                raise serializers.ValidationError({"unit_ids": "Selecione as unidades de atendimento."})
            attrs["units"] = units
    if not units:
        raise serializers.ValidationError({"unit_ids": "Selecione ao menos uma unidade de atendimento."})
    ids = {unit.pk for unit in units}
    previous = set(instance.units.values_list("pk", flat=True)) if instance else set()
    if any(unit.company_id != company.pk or (not unit.is_active and unit.pk not in previous) for unit in units):
        raise serializers.ValidationError({"unit_ids": "Selecione unidades ativas desta empresa."})
    related = attrs.get(related_name)
    if related is None:
        related = list(getattr(instance, related_name).prefetch_related("units")) if instance else []
    # ASVS V8.2/V8.4: validate both tenant and unit relationships on the server.
    if any(item.company_id != company.pk or not ids.intersection(unit.pk for unit in item.units.all()) for item in related):
        raise serializers.ValidationError({related_field: "Selecione recursos das mesmas unidades de atendimento."})
    name = attrs.get("name", getattr(instance, "name", ""))
    model = instance.__class__ if instance else (company.services.model if related_name == "professionals" else company.professionals.model)
    duplicates = model.objects.filter(company=company, name=name, units__in=units)
    if instance:
        duplicates = duplicates.exclude(pk=instance.pk)
    if duplicates.exists():
        raise serializers.ValidationError({"name": "Já existe um cadastro com este nome nesta unidade."})
    return ids


class CompanyUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyUnit
        fields = ("id", "name", "address", "city", "state", "is_active", "is_primary")
        read_only_fields = ("id",)
        validators = []

    def validate(self, attrs):
        company = self.context["company"]
        name = attrs.get("name", getattr(self.instance, "name", ""))
        duplicate = CompanyUnit.objects.filter(company=company, name=name)
        if self.instance:
            duplicate = duplicate.exclude(pk=self.instance.pk)
        if duplicate.exists():
            raise serializers.ValidationError({"name": "Já existe uma unidade com este nome."})
        primary = attrs.get("is_primary", getattr(self.instance, "is_primary", False))
        active = attrs.get("is_active", getattr(self.instance, "is_active", True))
        if primary and not active:
            raise serializers.ValidationError("A unidade principal deve permanecer ativa. Escolha outra principal primeiro.")
        if self.instance and self.instance.is_primary and not primary:
            raise serializers.ValidationError("Defina outra unidade como principal antes de alterar esta unidade.")
        return attrs

    def _primary(self, unit):
        if unit.is_primary:
            Company.objects.filter(pk=unit.company_id).update(address=unit.address, city=unit.city, state=unit.state)
        return unit

    def create(self, validated_data):
        company = validated_data["company"]
        if validated_data.get("is_primary"):
            company.units.filter(is_primary=True).update(is_primary=False)
        return self._primary(super().create(validated_data))

    def update(self, instance, validated_data):
        if validated_data.get("is_primary"):
            instance.company.units.exclude(pk=instance.pk).filter(is_primary=True).update(is_primary=False)
        return self._primary(super().update(instance, validated_data))


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

    @transaction.atomic
    def update(self, instance, validated_data):
        Company.objects.select_for_update().get(pk=instance.pk)
        updated = super().update(instance, validated_data)
        location = {field: validated_data[field] for field in ("address", "city", "state") if field in validated_data}
        if location:
            updated.units.filter(is_primary=True).update(**location)
        return updated

    def get_niche_label(self, obj):
        return obj.niche_custom if obj.niche == Company.Niche.OTHER else obj.get_niche_display()

    def get_business_type_label(self, obj):
        return obj.business_type_custom if obj.business_type == Company.BusinessType.OTHER else obj.get_business_type_display()

class PublicCompanySerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    units = serializers.SerializerMethodField()
    niche_label = serializers.SerializerMethodField()
    business_type_label = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = (
            "id", "units", "name", "slug", "whatsapp", "address", "city", "state", "niche", "niche_label",
            "business_type", "business_type_label", "public_notes", "status", "logo",
        )

    def get_niche_label(self, obj):
        return obj.niche_custom if obj.niche == Company.Niche.OTHER else obj.get_niche_display()

    def get_units(self, obj):
        return CompanyUnitSerializer([unit for unit in obj.units.all() if unit.is_active], many=True).data

    def get_business_type_label(self, obj):
        return obj.business_type_custom if obj.business_type == Company.BusinessType.OTHER else obj.get_business_type_display()


class PublicCompanySearchSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(read_only=True)
    units = serializers.SerializerMethodField()
    niche_label = serializers.SerializerMethodField()
    business_type_label = serializers.SerializerMethodField()
    average_rating = serializers.FloatField(read_only=True, allow_null=True)
    review_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Company
        fields = (
            "id", "units", "name", "slug", "city", "state", "niche", "niche_label",
            "business_type", "business_type_label", "address", "public_notes", "logo",
            "average_rating", "review_count",
        )

    def get_niche_label(self, obj):
        return obj.niche_custom if obj.niche == Company.Niche.OTHER else obj.get_niche_display()

    def get_units(self, obj):
        return CompanyUnitSerializer([unit for unit in obj.units.all() if unit.is_active], many=True).data

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
    ordering = serializers.ChoiceField(required=False, choices=("recommended", "name", "-name"), default="recommended")
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
    late_tolerance_warning = serializers.SerializerMethodField()

    class Meta:
        model = CompanyBookingSettings
        fields = (
            "late_tolerance", "minimum_change_notice", "whatsapp_waiting_message",
            "whatsapp_confirmed_message", "whatsapp_cancelled_message", "late_tolerance_warning", "updated_at",
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

    def get_late_tolerance_warning(self, obj):
        services = obj.company.services.filter(is_active=True).values_list("duration", "slot_interval")
        gaps = [max(0, int((slot_interval - duration).total_seconds())) for duration, slot_interval in services]
        shortest_gap = min(gaps) if gaps else None
        if shortest_gap is not None and obj.late_tolerance.total_seconds() > shortest_gap:
            return (
                f"Sua tolerância de {int(obj.late_tolerance.total_seconds() // 60)} minutos é maior que o intervalo "
                f"de {shortest_gap // 60} minutos. Atrasos acima do intervalo podem afetar o atendimento seguinte."
            )
        return ""
