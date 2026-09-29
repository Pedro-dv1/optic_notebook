from rest_framework import serializers

from .models import RegistrationKey


class RegistrationKeySerializer(serializers.ModelSerializer):
    state = serializers.CharField(read_only=True)
    created_by = serializers.UUIDField(source="created_by_id", read_only=True)
    consumed_by_company = serializers.UUIDField(source="consumed_by_company_id", read_only=True, allow_null=True)

    class Meta:
        model = RegistrationKey
        fields = ("id", "state", "created_by", "consumed_by_company", "created_at", "consumed_at")


class RegistrationKeyCreateSerializer(serializers.Serializer):
    authorization_key = serializers.CharField(read_only=True)
