import logging
from datetime import datetime, time, timedelta

from django.db import transaction
from django.db.models import Count, F, IntegerField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework.viewsets import ReadOnlyModelViewSet

from platform_core.permissions import IsCompanyAdmin, IsSuperuser, company_for_user
from platform_core.throttles import WindowScopedRateThrottle
from platform_core.search import accent_insensitive_query, normalized_contains

from bookings.models import Appointment

from .models import Company, CompanyDailyMetric, CompanyViewVisitor
from .serializers import (
    CompanyViewSerializer,
    CompanyBookingSettingsSerializer,
    CompanyRegistrationSerializer,
    CompanySerializer,
    PlatformCompanySerializer,
    PublicCompanySerializer,
    PublicCompanySearchQuerySerializer,
    PublicCompanySearchSerializer,
)

security_logger = logging.getLogger("optic_notebook.security")


def _month_periods():
    today = timezone.localdate()
    current_start = today.replace(day=1)
    next_start = (current_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    previous_start = (current_start - timedelta(days=1)).replace(day=1)
    aware = timezone.make_aware
    return (
        aware(datetime.combine(current_start, time.min)),
        aware(datetime.combine(next_start, time.min)),
        aware(datetime.combine(previous_start, time.min)),
        current_start,
        next_start,
        previous_start,
    )


def _count_subquery(queryset, field="id"):
    return Coalesce(
        Subquery(
            queryset.values("company").annotate(value=Count(field, distinct=True)).values("value")[:1],
            output_field=IntegerField(),
        ),
        Value(0),
    )


def _sum_subquery(queryset, field):
    return Coalesce(
        Subquery(
            queryset.values("company").annotate(value=Sum(field)).values("value")[:1],
            output_field=IntegerField(),
        ),
        Value(0),
    )


def platform_company_queryset():
    current_start, next_start, previous_start, current_date, next_date, previous_date = _month_periods()
    appointments = Appointment.objects.filter(company=OuterRef("pk"))
    metrics = CompanyDailyMetric.objects.filter(company=OuterRef("pk"))
    visitors = CompanyViewVisitor.objects.filter(company=OuterRef("pk"))
    return Company.objects.select_related("owner").annotate(
        appointments_this_month=_count_subquery(
            appointments.filter(starts_at__gte=current_start, starts_at__lt=next_start)
        ),
        appointments_previous_month=_count_subquery(
            appointments.filter(starts_at__gte=previous_start, starts_at__lt=current_start)
        ),
        total_appointments=_count_subquery(appointments),
        views_this_month=_sum_subquery(metrics.filter(date__gte=current_date, date__lt=next_date), "views"),
        views_previous_month=_sum_subquery(metrics.filter(date__gte=previous_date, date__lt=current_date), "views"),
        total_views=_sum_subquery(metrics, "views"),
        unique_visitors_this_month=_count_subquery(
            visitors.filter(date__gte=current_date, date__lt=next_date), "visitor_digest"
        ),
        unique_visitors_previous_month=_count_subquery(
            visitors.filter(date__gte=previous_date, date__lt=current_date), "visitor_digest"
        ),
    )


class PublicCompanyPagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 48


@method_decorator(csrf_protect, name="dispatch")
class CompanyRegistrationView(generics.CreateAPIView):
    permission_classes = (AllowAny,)
    serializer_class = CompanyRegistrationSerializer
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "company_registration"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = serializer.save()
        security_logger.info("registration_key_consumed company_id=%s owner_id=%s", company.id, company.owner_id)
        return Response(CompanySerializer(company).data, status=status.HTTP_201_CREATED)


class CompanyProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = (IsCompanyAdmin,)
    serializer_class = CompanySerializer

    def get_object(self):
        company = company_for_user(self.request.user)
        if company.status != Company.Status.ACTIVE and self.request.method not in ("GET", "HEAD", "OPTIONS"):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Esta conta está suspensa.")
        return company


class CompanySettingsView(generics.RetrieveUpdateAPIView):
    permission_classes = (IsCompanyAdmin,)
    serializer_class = CompanyBookingSettingsSerializer

    def get_object(self):
        company = company_for_user(self.request.user)
        if company.status != Company.Status.ACTIVE and self.request.method not in ("GET", "HEAD", "OPTIONS"):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Esta conta está suspensa.")
        return company.booking_settings


class PlatformCompanyViewSet(ReadOnlyModelViewSet):
    permission_classes = (IsSuperuser,)
    serializer_class = PlatformCompanySerializer
    queryset = Company.objects.none()

    def get_queryset(self):
        queryset = platform_company_queryset()
        if query := self.request.query_params.get("q", "").strip():
            if len(query) > 150:
                from rest_framework.exceptions import ValidationError

                raise ValidationError({"q": "A pesquisa deve ter no máximo 150 caracteres."})
            queryset = queryset.filter(accent_insensitive_query(query, "name", "slug"))
        status_filter = self.request.query_params.get("status", "").strip().upper()
        if status_filter in Company.Status.values:
            queryset = queryset.filter(status=status_filter)
        return queryset

    @action(detail=True, methods=("post",))
    def suspend(self, request, pk=None):
        company = self.get_object()
        company.status = Company.Status.SUSPENDED
        company.save(update_fields=("status", "updated_at"))
        security_logger.info("company_suspended company_id=%s actor_id=%s", company.id, request.user.id)
        return Response(self.get_serializer(company).data)

    @action(detail=True, methods=("post",))
    def reactivate(self, request, pk=None):
        company = self.get_object()
        company.status = Company.Status.ACTIVE
        company.save(update_fields=("status", "updated_at"))
        security_logger.info("company_reactivated company_id=%s actor_id=%s", company.id, request.user.id)
        return Response(self.get_serializer(company).data)


class PublicCompanyDetailView(generics.RetrieveAPIView):
    permission_classes = (AllowAny,)
    serializer_class = PublicCompanySerializer
    lookup_field = "slug"
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "public_read"

    def get_queryset(self):
        return Company.objects.all()


class PublicCompanySearchView(generics.ListAPIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    serializer_class = PublicCompanySearchSerializer
    pagination_class = PublicCompanyPagination
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "public_read"

    def get_queryset(self):
        filters = PublicCompanySearchQuerySerializer(data=self.request.query_params)
        filters.is_valid(raise_exception=True)
        values = filters.validated_data
        queryset = Company.objects.filter(status=Company.Status.ACTIVE)
        query = (values.get("search") or values.get("q") or "").strip()
        if query:
            matching_niches = [value for value, label in Company.Niche.choices if normalized_contains(query, label)]
            matching_types = [value for value, label in Company.BusinessType.choices if normalized_contains(query, label)]
            queryset = queryset.filter(
                accent_insensitive_query(
                    query, "name", "niche_custom", "business_type_custom", "niche", "business_type",
                )
                | Q(niche__in=matching_niches)
                | Q(business_type__in=matching_types)
                | Q(services__name__unaccent__icontains=query, services__is_active=True)
            )
        if state_filter := values.get("state"):
            queryset = queryset.filter(state=state_filter)
        if city := values.get("city", "").strip():
            queryset = queryset.filter(city__unaccent__iexact=city)
        if niche := values.get("niche"):
            queryset = queryset.filter(niche=niche)
        if business_type := values.get("business_type"):
            queryset = queryset.filter(business_type=business_type)
        if service := values.get("service", "").strip():
            queryset = queryset.filter(services__name__unaccent__icontains=service, services__is_active=True)
        return queryset.distinct().order_by(values["ordering"], "slug")


class PublicCompanyViewEventView(generics.GenericAPIView):
    permission_classes = (AllowAny,)
    authentication_classes = ()
    serializer_class = CompanyViewSerializer
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "public_read"

    def post(self, request, slug):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        company = get_object_or_404(Company, slug=slug, status=Company.Status.ACTIVE)
        now = timezone.now()
        date = timezone.localdate(now)
        digest = CompanyViewVisitor.digest_visitor(f"{company.id}:{serializer.validated_data['visitor_id']}")
        with transaction.atomic():
            metric, _ = CompanyDailyMetric.objects.get_or_create(company=company, date=date)
            visitor, created = CompanyViewVisitor.objects.select_for_update().get_or_create(
                company=company,
                date=date,
                visitor_digest=digest,
                defaults={"last_viewed_at": now},
            )
            should_count = created or visitor.last_viewed_at <= now - timedelta(minutes=30)
            if should_count:
                updates = {"views": F("views") + 1}
                if created:
                    updates["unique_visitors"] = F("unique_visitors") + 1
                CompanyDailyMetric.objects.filter(pk=metric.pk).update(**updates)
                if not created:
                    visitor.last_viewed_at = now
                    visitor.save(update_fields=("last_viewed_at",))
        return Response(status=status.HTTP_204_NO_CONTENT)


class PlatformMetricsView(generics.GenericAPIView):
    permission_classes = (IsSuperuser,)

    def get(self, request):
        current_start, next_start, _, current_date, next_date, _ = _month_periods()
        appointments = Appointment.objects.aggregate(
            total=Count("id"),
            this_month=Count("id", filter=Q(starts_at__gte=current_start, starts_at__lt=next_start)),
        )
        metrics = CompanyDailyMetric.objects.filter(date__gte=current_date, date__lt=next_date).aggregate(
            views=Coalesce(Sum("views"), Value(0)),
        )
        unique_visitors = CompanyViewVisitor.objects.filter(
            date__gte=current_date,
            date__lt=next_date,
        ).aggregate(total=Count("visitor_digest", distinct=True))["total"]
        return Response(
            {
                "total_companies": Company.objects.count(),
                "active_companies": Company.objects.filter(status=Company.Status.ACTIVE).count(),
                "appointments_this_month": appointments["this_month"],
                "total_appointments": appointments["total"],
                "views_this_month": metrics["views"],
                "unique_visitors_this_month": unique_visitors,
            }
        )
