from django.db import transaction
from rest_framework.permissions import AllowAny
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from companies.models import Company
from platform_core.permissions import IsActiveCompanyAdmin, company_for_user
from platform_core.throttles import WindowScopedRateThrottle

from .models import Professional, WorkSchedule
from .serializers import (
    ProfessionalAdminSerializer,
    PublicProfessionalQuerySerializer,
    PublicProfessionalSerializer,
    WorkScheduleSerializer,
)


class CompanyProfessionalViewSet(viewsets.ModelViewSet):
    permission_classes = (IsActiveCompanyAdmin,)
    serializer_class = ProfessionalAdminSerializer

    def get_queryset(self):
        return Professional.objects.filter(company=company_for_user(self.request.user)).prefetch_related("services")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["company"] = company_for_user(self.request.user)
        return context

    def perform_create(self, serializer):
        serializer.save(company=company_for_user(self.request.user))


class CompanyWorkScheduleViewSet(viewsets.ModelViewSet):
    permission_classes = (IsActiveCompanyAdmin,)
    serializer_class = WorkScheduleSerializer

    def get_queryset(self):
        return WorkSchedule.objects.filter(professional__company=company_for_user(self.request.user)).select_related("professional")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["company"] = company_for_user(self.request.user)
        return context

    @action(detail=False, methods=("post",), url_path="week")
    def week(self, request):
        serializers = [self.get_serializer(data={**request.data, "weekday": day}) for day in range(7)]
        with transaction.atomic():
            for serializer in serializers:
                serializer.is_valid(raise_exception=True)
            schedules = [serializer.save() for serializer in serializers]
        return Response(self.get_serializer(schedules, many=True).data, status=status.HTTP_201_CREATED)


class PublicProfessionalListView(generics.ListAPIView):
    permission_classes = (AllowAny,)
    serializer_class = PublicProfessionalSerializer
    pagination_class = None
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "public_read"

    def get_queryset(self):
        filters = PublicProfessionalQuerySerializer(data=self.request.query_params)
        filters.is_valid(raise_exception=True)
        company = get_object_or_404(Company, slug=self.kwargs["slug"], status=Company.Status.ACTIVE)
        queryset = Professional.objects.filter(
            company=company,
            is_active=True,
        ).prefetch_related("services")
        service_id = filters.validated_data.get("service")
        if service_id:
            queryset = queryset.filter(services__id=service_id, services__is_active=True)
        return queryset.distinct()
