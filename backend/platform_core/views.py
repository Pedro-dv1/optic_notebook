import logging

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from companies.models import BUSINESS_TYPES_BY_NICHE, Company

from .models import RegistrationKey
from .permissions import IsSuperuser
from .serializers import RegistrationKeyCreateSerializer, RegistrationKeySerializer

security_logger = logging.getLogger("optic_notebook.security")


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfCookieView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def get(self, request):
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublicPlatformConfigView(APIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()

    def get(self, request):
        return Response(
            {
                "name": settings.PLATFORM_NAME,
                "support_email": settings.PLATFORM_SUPPORT_EMAIL,
                "company_options": {
                    "states": [{"value": value, "label": label} for value, label in Company.STATE_CHOICES],
                    "niches": [{"value": value, "label": label} for value, label in Company.Niche.choices],
                    "business_types": [
                        {"value": value, "label": label} for value, label in Company.BusinessType.choices
                    ],
                    "business_types_by_niche": {
                        niche: list(business_types) for niche, business_types in BUSINESS_TYPES_BY_NICHE.items()
                    },
                },
            }
        )


class RegistrationKeyListCreateView(generics.ListCreateAPIView):
    permission_classes = (IsSuperuser,)
    queryset = RegistrationKey.objects.select_related("created_by", "consumed_by_company").all()

    def get_serializer_class(self):
        if self.request.method == "POST":
            return RegistrationKeyCreateSerializer
        return RegistrationKeySerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        state = self.request.query_params.get("state", "").strip().upper()
        if state == "ACTIVE":
            return queryset.filter(is_active=True, consumed_at__isnull=True)
        if state == "CONSUMED":
            return queryset.filter(consumed_at__isnull=False)
        if state == "INACTIVE":
            return queryset.filter(is_active=False, consumed_at__isnull=True)
        return queryset

    def create(self, request, *args, **kwargs):
        registration_key, secret = RegistrationKey.issue(request.user)
        security_logger.info("registration_key_created key_id=%s actor_id=%s", registration_key.id, request.user.id)
        return Response({"id": registration_key.id, "authorization_key": secret}, status=status.HTTP_201_CREATED)
