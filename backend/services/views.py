from rest_framework import generics, viewsets
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404

from companies.models import Company
from platform_core.permissions import IsActiveCompanyAdmin, company_for_user
from platform_core.throttles import WindowScopedRateThrottle

from .models import Service
from .serializers import PublicServiceSerializer, ServiceAdminSerializer


class CompanyServiceViewSet(viewsets.ModelViewSet):
    permission_classes = (IsActiveCompanyAdmin,)
    serializer_class = ServiceAdminSerializer

    def get_queryset(self):
        return Service.objects.filter(company=company_for_user(self.request.user)).prefetch_related("professionals")

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
        return Service.objects.filter(
            company=company,
            is_active=True,
        )
