import logging

from django.db import transaction
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.shortcuts import get_object_or_404

from companies.models import Company
from platform_core.permissions import IsActiveCompanyAdmin, company_for_user
from platform_core.throttles import WindowScopedRateThrottle
from bookings.models import Appointment
from bookings.operations import resolve_company_unit

from .models import Professional, ProfessionalAccessInvite, ProfessionalUnavailability, WorkSchedule
from .serializers import (
    ProfessionalAdminSerializer,
    ProfessionalAccessInviteSerializer,
    ProfessionalUnavailabilitySerializer,
    PublicProfessionalQuerySerializer,
    PublicProfessionalSerializer,
    WorkScheduleSerializer,
)

security_logger = logging.getLogger("optic_notebook.security")


class CompanyProfessionalViewSet(viewsets.ModelViewSet):
    permission_classes = (IsActiveCompanyAdmin,)
    serializer_class = ProfessionalAdminSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        Company.objects.select_for_update(no_key=True).get(pk=company_for_user(request.user).pk)
        return super().create(request, *args, **kwargs)

    def get_queryset(self):
        return Professional.objects.filter(company=company_for_user(self.request.user)).select_related("user").prefetch_related("services", "units", "access_invites")

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        Company.objects.select_for_update(no_key=True).get(pk=company_for_user(request.user).pk)
        return super().update(request, *args, **kwargs)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["company"] = company_for_user(self.request.user)
        return context

    def perform_create(self, serializer):
        serializer.save(company=company_for_user(self.request.user))

    @action(detail=True, methods=("post",), url_path="access-key")
    def access_key(self, request, pk=None):
        professional = self.get_object()
        with transaction.atomic():
            professional = self.get_queryset().select_for_update(of=("self",)).get(pk=professional.pk)
            if professional.user_id:
                raise ValidationError("Este profissional já possui uma conta vinculada.")
            if professional.access_invites.filter(
                used_at__isnull=True,
                revoked_at__isnull=True,
                expires_at__gt=timezone.now(),
            ).exists():
                raise ValidationError("Este profissional já possui uma chave de acesso ativa.")
            invite, secret = ProfessionalAccessInvite.issue(professional=professional, created_by=request.user)
        data = ProfessionalAccessInviteSerializer(invite).data
        data["access_key"] = secret
        security_logger.info("professional_invite_issued professional_id=%s actor_id=%s", professional.id, request.user.id)
        return Response(data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",), url_path="revoke-access")
    def revoke_access(self, request, pk=None):
        professional = self.get_object()
        with transaction.atomic():
            professional = self.get_queryset().select_for_update(of=("self",)).get(pk=professional.pk)
            professional.access_invites.filter(used_at__isnull=True, revoked_at__isnull=True).update(revoked_at=timezone.now())
            professional.access_active = False
            professional.save(update_fields=("access_active", "updated_at"))
        security_logger.info("professional_access_revoked professional_id=%s actor_id=%s", professional.id, request.user.id)
        return Response(self.get_serializer(professional).data)


class CompanyWorkScheduleViewSet(viewsets.ModelViewSet):
    permission_classes = (IsActiveCompanyAdmin,)
    serializer_class = WorkScheduleSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        Company.objects.select_for_update(no_key=True).get(pk=company_for_user(request.user).pk)
        return super().create(request, *args, **kwargs)

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        Company.objects.select_for_update(no_key=True).get(pk=company_for_user(request.user).pk)
        return super().update(request, *args, **kwargs)

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
            Company.objects.select_for_update(no_key=True).get(pk=company_for_user(request.user).pk)
            for serializer in serializers:
                serializer.is_valid(raise_exception=True)
            schedules = [serializer.save() for serializer in serializers]
        return Response(self.get_serializer(schedules, many=True).data, status=status.HTTP_201_CREATED)


class CompanyUnavailabilityViewSet(viewsets.ModelViewSet):
    permission_classes = (IsActiveCompanyAdmin,)
    serializer_class = ProfessionalUnavailabilitySerializer

    def get_queryset(self):
        return ProfessionalUnavailability.objects.filter(company=company_for_user(self.request.user)).select_related("professional", "created_by")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["company"] = company_for_user(self.request.user)
        return context

    def perform_create(self, serializer):
        self._save(serializer, creating=True)

    def perform_update(self, serializer):
        self._save(serializer, creating=False)

    def _save(self, serializer, *, creating):
        company = company_for_user(self.request.user)
        starts_at = serializer.validated_data.get("starts_at", serializer.instance.starts_at if serializer.instance else None)
        ends_at = serializer.validated_data.get("ends_at", serializer.instance.ends_at if serializer.instance else None)
        professional = serializer.validated_data.get("professional", serializer.instance.professional if serializer.instance else None)
        with transaction.atomic():
            Professional.objects.select_for_update().get(pk=professional.pk, company=company)
            conflicts = Appointment.objects.filter(
                company=company,
                professional=professional,
                status__in=(Appointment.Status.WAITING_CONFIRMATION, Appointment.Status.CONFIRMED),
                starts_at__lt=ends_at,
                ends_at__gt=starts_at,
            ).count()
            allow_conflicts = serializer.validated_data.pop("allow_conflicts", False)
            if conflicts and not allow_conflicts:
                error = ValidationError({"conflicts": conflicts, "detail": "Existem agendamentos neste período. Confirme o bloqueio conscientemente."})
                error.status_code = status.HTTP_409_CONFLICT
                raise error
            if creating:
                serializer.save(company=company, created_by=self.request.user)
            else:
                serializer.save()


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
        ).prefetch_related("services", "units")
        if unit_id := filters.validated_data.get("unit"):
            queryset = queryset.filter(units=resolve_company_unit(company, unit_id))
        service_id = filters.validated_data.get("service")
        if service_id:
            queryset = queryset.filter(services__id=service_id, services__is_active=True)
        return queryset.distinct()
