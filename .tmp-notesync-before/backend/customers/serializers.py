from accounts.serializers import (
    AccountActionRequestSerializer,
    CustomerPasswordChangeSerializer,
    CustomerProfileSerializer,
    CustomerRegistrationSerializer,
    NewEmailRequestSerializer,
    NewEmailVerificationSerializer,
    OtpVerificationSerializer,
)
from rest_framework import serializers
from companies.models import Company
from companies.serializers import PublicCompanySearchSerializer
from .models import CompanyFavorite


class CompanyFavoriteSerializer(serializers.ModelSerializer):
    company = serializers.PrimaryKeyRelatedField(queryset=Company.objects.filter(status=Company.Status.ACTIVE))
    company_details = PublicCompanySearchSerializer(source="company", read_only=True)

    class Meta:
        model = CompanyFavorite
        fields = ("id", "company", "company_details", "created_at")
        read_only_fields = ("id", "created_at")
        validators = []


class FavoriteSuggestionDismissSerializer(serializers.Serializer):
    company = serializers.PrimaryKeyRelatedField(queryset=Company.objects.filter(status=Company.Status.ACTIVE))

__all__ = (
    "AccountActionRequestSerializer",
    "CustomerPasswordChangeSerializer",
    "CustomerProfileSerializer",
    "CustomerRegistrationSerializer",
    "NewEmailRequestSerializer",
    "NewEmailVerificationSerializer",
    "OtpVerificationSerializer",
)
