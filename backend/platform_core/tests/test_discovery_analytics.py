from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from bookings.models import Appointment
from companies.models import CompanyDailyMetric, CompanyViewVisitor
from services.models import Service

from .helpers import PASSWORD, create_booking_catalog, create_company


class PublicCompanyDiscoveryTests(APITestCase):
    def setUp(self):
        _, self.barbershop = create_company("barbershop")
        self.barbershop.name = "Zeta Barbearia"
        self.barbershop.city = "Jales"
        self.barbershop.state = "SP"
        self.barbershop.niche = "Beauty"
        self.barbershop.business_type = "Barbershop"
        self.barbershop.tax_identifier = "12345678000190"
        self.barbershop.save()
        Service.objects.create(company=self.barbershop, name="Corte masculino", duration=timedelta(minutes=30))

        _, self.clinic = create_company("clinic")
        self.clinic.name = "Alfa Clínica"
        self.clinic.city = "Belo Horizonte"
        self.clinic.state = "MG"
        self.clinic.niche = "Health"
        self.clinic.business_type = "Clinic"
        self.clinic.city = "São José"
        self.clinic.save()
        Service.objects.create(company=self.clinic, name="Avaliação clínica", duration=timedelta(minutes=45))

    def search(self, **params):
        return self.client.get("/api/v1/public/companies/", params)

    def test_searches_company_and_service_and_applies_discovery_filters(self):
        for params, expected_slug in (
            ({"search": "corte"}, self.barbershop.slug),
            ({"state": "SP", "city": "Jales"}, self.barbershop.slug),
            ({"niche": "Health", "business_type": "Clinic"}, self.clinic.slug),
            ({"service": "avaliacao"}, self.clinic.slug),
        ):
            with self.subTest(params=params):
                response = self.search(**params)
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual([item["slug"] for item in response.data["results"]], [expected_slug])

    def test_search_ignores_accents_and_case(self):
        for params in ({"search": "CLINICA"}, {"service": "avaliacao"}, {"city": "Sao Jose"}):
            with self.subTest(params=params):
                response = self.search(**params)
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual([item["slug"] for item in response.data["results"]], [self.clinic.slug])

    def test_orders_and_paginates_without_exposing_private_fields(self):
        ascending = self.search(ordering="name")
        descending = self.search(ordering="-name")
        self.assertEqual(ascending.data["count"], 2)
        self.assertEqual(ascending.data["results"][0]["slug"], self.clinic.slug)
        self.assertEqual(descending.data["results"][0]["slug"], self.barbershop.slug)
        serialized = str(ascending.data)
        self.assertNotIn(self.barbershop.owner.email, serialized)
        self.assertNotIn(self.barbershop.tax_identifier, serialized)
        self.assertNotIn("owner", ascending.data["results"][0])

    def test_invalid_filter_is_rejected(self):
        response = self.search(state="XX", ordering="drop table")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class CompanyAnalyticsAndPlatformMetricsTests(APITestCase):
    def setUp(self):
        self.superuser = User.objects.create_superuser("metrics-root@example.com", PASSWORD, full_name="Root")
        self.common_user = User.objects.create_user("metrics-common@example.com", PASSWORD, full_name="Common")
        self.owner, self.company = create_company("metrics")

    def record_view(self, visitor_id="visitor_identifier_123456789"):
        return self.client.post(
            f"/api/v1/public/companies/{self.company.slug}/view/",
            {"visitor_id": visitor_id},
            format="json",
        )

    def test_view_metrics_are_aggregated_and_refreshes_are_deduplicated(self):
        self.assertEqual(self.record_view().status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.record_view().status_code, status.HTTP_204_NO_CONTENT)
        metric = CompanyDailyMetric.objects.get(company=self.company, date=timezone.localdate())
        self.assertEqual((metric.views, metric.unique_visitors), (1, 1))
        visitor = CompanyViewVisitor.objects.get(company=self.company)
        self.assertNotEqual(visitor.visitor_digest, "visitor_identifier_123456789")
        visitor.last_viewed_at = timezone.now() - timedelta(minutes=31)
        visitor.save(update_fields=("last_viewed_at",))
        self.record_view()
        metric.refresh_from_db()
        self.assertEqual((metric.views, metric.unique_visitors), (2, 1))

    def test_platform_metrics_and_company_period_counts_use_real_data(self):
        service, professional, _ = create_booking_catalog(self.company)
        starts_at = timezone.now().replace(day=1, hour=12, minute=0, second=0, microsecond=0)
        Appointment.objects.create(
            company=self.company,
            service=service,
            professional=professional,
            starts_at=starts_at,
            ends_at=starts_at + service.duration,
            customer_name="Cliente",
            customer_email="cliente@example.com",
            customer_whatsapp="+5511988887777",
        )
        self.record_view()
        self.client.force_authenticate(self.superuser)
        summary = self.client.get("/api/v1/platform/metrics/")
        companies = self.client.get("/api/v1/platform/companies/")
        self.assertEqual(summary.status_code, status.HTTP_200_OK)
        self.assertEqual(summary.data["total_companies"], 1)
        self.assertEqual(summary.data["views_this_month"], 1)
        item = companies.data["results"][0]
        self.assertEqual(item["appointments_this_month"], 1)
        self.assertEqual(item["views_this_month"], 1)
        self.assertEqual(item["unique_visitors_this_month"], 1)

    def test_every_platform_api_denies_non_superusers(self):
        endpoints = (
            "/api/v1/platform/metrics/",
            "/api/v1/platform/companies/",
            "/api/v1/platform/registration-keys/",
        )
        for endpoint in endpoints:
            with self.subTest(endpoint=endpoint, actor="anonymous"):
                self.client.force_authenticate(user=None)
                self.assertEqual(self.client.get(endpoint).status_code, status.HTTP_401_UNAUTHORIZED)
            for actor in (self.common_user, self.owner):
                with self.subTest(endpoint=endpoint, actor=actor.email):
                    self.client.force_authenticate(actor)
                    self.assertEqual(self.client.get(endpoint).status_code, status.HTTP_403_FORBIDDEN)
            with self.subTest(endpoint=endpoint, actor="superuser"):
                self.client.force_authenticate(self.superuser)
                self.assertEqual(self.client.get(endpoint).status_code, status.HTTP_200_OK)
