from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from accounts.views import LoginView, LogoutView, MeView, RefreshView
from bookings.views import (
    AvailabilityView,
    CompanyAppointmentViewSet,
    CustomerAppointmentViewSet,
    PublicAppointmentCancelView,
    PublicAppointmentCreateView,
    PublicAppointmentRescheduleView,
    CompanyCustomerListView,
)
from companies.views import (
    CompanyProfileView,
    CompanyRegistrationView,
    CompanySettingsView,
    PlatformMetricsView,
    PlatformCompanyViewSet,
    PublicCompanyDetailView,
    PublicCompanySearchView,
    PublicCompanyViewEventView,
)
from customers.views import (
    CustomerPasswordChangeView,
    CustomerProfileView,
    CustomerRegistrationView,
    EmailChangeCurrentRequestView,
    EmailChangeCurrentVerifyView,
    EmailChangeNewRequestView,
    EmailChangeNewVerifyView,
    PasswordOtpRequestView,
    PasswordOtpVerifyView,
)
from platform_core.views import CsrfCookieView, CurrentLegalDocumentsView, PublicPlatformConfigView, RegistrationKeyListCreateView
from professionals.views import CompanyProfessionalViewSet, CompanyWorkScheduleViewSet, PublicProfessionalListView
from services.views import CompanyServiceViewSet, PublicServiceListView

platform_router = DefaultRouter()
platform_router.register("companies", PlatformCompanyViewSet, basename="platform-company")

company_router = DefaultRouter()
company_router.register("services", CompanyServiceViewSet, basename="company-service")
company_router.register("professionals", CompanyProfessionalViewSet, basename="company-professional")
company_router.register("work-schedules", CompanyWorkScheduleViewSet, basename="company-work-schedule")
company_router.register("appointments", CompanyAppointmentViewSet, basename="company-appointment")

customer_router = DefaultRouter()
customer_router.register("appointments", CustomerAppointmentViewSet, basename="customer-appointment")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/login/", LoginView.as_view(), name="login"),
    path("api/v1/auth/refresh/", RefreshView.as_view(), name="refresh"),
    path("api/v1/auth/logout/", LogoutView.as_view(), name="logout"),
    path("api/v1/auth/me/", MeView.as_view(), name="me"),
    path("api/v1/auth/csrf/", CsrfCookieView.as_view(), name="csrf-cookie"),
    path("api/v1/platform/registration-keys/", RegistrationKeyListCreateView.as_view(), name="registration-keys"),
    path("api/v1/platform/metrics/", PlatformMetricsView.as_view(), name="platform-metrics"),
    path("api/v1/platform/", include(platform_router.urls)),
    path("api/v1/companies/register/", CompanyRegistrationView.as_view(), name="company-register"),
    path("api/v1/company/profile/", CompanyProfileView.as_view(), name="company-profile"),
    path("api/v1/company/settings/", CompanySettingsView.as_view(), name="company-settings"),
    path("api/v1/company/customers/", CompanyCustomerListView.as_view(), name="company-customers"),
    path("api/v1/company/", include(company_router.urls)),
    path("api/v1/public/platform/", PublicPlatformConfigView.as_view(), name="public-platform-config"),
    path("api/v1/legal/current/", CurrentLegalDocumentsView.as_view(), name="current-legal-documents"),
    path("api/v1/public/companies/", PublicCompanySearchView.as_view(), name="public-company-search"),
    path("api/v1/public/companies/<slug:slug>/", PublicCompanyDetailView.as_view(), name="public-company"),
    path(
        "api/v1/public/companies/<slug:slug>/view/",
        PublicCompanyViewEventView.as_view(),
        name="public-company-view",
    ),
    path("api/v1/public/companies/<slug:slug>/services/", PublicServiceListView.as_view(), name="public-services"),
    path(
        "api/v1/public/companies/<slug:slug>/professionals/",
        PublicProfessionalListView.as_view(),
        name="public-professionals",
    ),
    path("api/v1/public/companies/<slug:slug>/availability/", AvailabilityView.as_view(), name="availability"),
    path(
        "api/v1/public/companies/<slug:slug>/appointments/",
        PublicAppointmentCreateView.as_view(),
        name="public-appointment-create",
    ),
    path(
        "api/v1/public/companies/<slug:slug>/appointments/cancel/",
        PublicAppointmentCancelView.as_view(),
        name="public-appointment-cancel",
    ),
    path(
        "api/v1/public/companies/<slug:slug>/appointments/reschedule/",
        PublicAppointmentRescheduleView.as_view(),
        name="public-appointment-reschedule",
    ),
    path("api/v1/customers/register/", CustomerRegistrationView.as_view(), name="customer-register"),
    path("api/v1/customers/profile/me/", CustomerProfileView.as_view(), name="customer-profile"),
    path("api/v1/customers/security/password/request/", PasswordOtpRequestView.as_view(), name="customer-password-request"),
    path("api/v1/customers/security/password/verify/", PasswordOtpVerifyView.as_view(), name="customer-password-verify"),
    path("api/v1/customers/password/change/", CustomerPasswordChangeView.as_view(), name="customer-password-change"),
    path(
        "api/v1/customers/security/email-change/current/request/",
        EmailChangeCurrentRequestView.as_view(),
        name="customer-email-current-request",
    ),
    path(
        "api/v1/customers/security/email-change/current/verify/",
        EmailChangeCurrentVerifyView.as_view(),
        name="customer-email-current-verify",
    ),
    path(
        "api/v1/customers/security/email-change/new/request/",
        EmailChangeNewRequestView.as_view(),
        name="customer-email-new-request",
    ),
    path(
        "api/v1/customers/security/email-change/new/verify/",
        EmailChangeNewVerifyView.as_view(),
        name="customer-email-new-verify",
    ),
    path("api/v1/customers/", include(customer_router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
