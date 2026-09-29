from rest_framework import generics, viewsets
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404

from companies.models import Company
from platform_core.permissions import IsActiveCompanyAdmin, company_for_user
from platform_core.throttles import WindowScopedRateThrottle

from .models import Service
from .serializers import PublicServiceSerializer, ServiceAdminSerializer
from bookings.operations import resolve_company_unit
from bookings.serializers import UnitQuerySerializer
from django.db.models import Q
from django.db import transaction


class CompanyServiceViewSet(viewsets.ModelViewSet):
    permission_classes = (IsActiveCompanyAdmin,)
    serializer_class = ServiceAdminSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        Company.objects.select_for_update(no_key=True).get(pk=company_for_user(request.user).pk)
        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        Company.objects.select_for_update(no_key=True).get(pk=company_for_user(request.user).pk)
        return super().update(request, *args, **kwargs)

    def get_queryset(self):
        return Service.objects.filter(company=company_for_user(self.request.user)).prefetch_related("professionals", "units")

    def perform_create(self, serializer):
        serializer.save(company=company_for_user(self.request.user))

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["company"] = company_for_user(self.request.user)
        return context


class PublicServiceListView(generics.ListAPIView):
    permission_classes = (AllowAny,)
    serializer_class = PublicServiceSerializer
    pagination_class = None
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "public_read"

    def get_queryset(self):
        company = get_object_or_404(Company, slug=self.kwargs["slug"], status=Company.Status.ACTIVE)
        query = UnitQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        queryset = Service.objects.filter(
            company=company,
            is_active=True,
        ).prefetch_related("units")
        if unit_id := query.validated_data.get("unit"):
            unit = resolve_company_unit(company, unit_id)
            queryset = queryset.filter(Q(units=unit) | Q(units__isnull=True)).distinct()
        return queryset
