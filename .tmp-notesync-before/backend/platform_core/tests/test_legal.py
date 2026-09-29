from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from companies.models import Company
from platform_core.legal import PRIVACY_VERSION, TERMS_VERSION
from platform_core.models import LegalAcceptance, RegistrationKey

from .helpers import PASSWORD, booking_payload, create_booking_catalog, create_company


class LegalAcceptanceTests(APITestCase):
    def setUp(self):
        cache.clear()

    def customer_payload(self, **overrides):
        payload = {
            "email": "legal-customer@example.com",
            "password": PASSWORD,
            "full_name": "Legal Customer",
            "whatsapp": "+5511988887777",
            "terms_accepted": True,
            "privacy_accepted": True,
        }
        payload.update(overrides)
        return payload

    def company_payload(self, key, **overrides):
        payload = {
            "authorization_key": key,
            "owner_email": "legal-owner@example.com",
            "owner_password": PASSWORD,
            "owner_name": "Legal Owner",
            "owner_whatsapp": "+5511977776666",
            "name": "Legal Company",
            "slug": "legal-company",
            "whatsapp": "+5511966665555",
            "city": "Jales",
            "state": "SP",
            "niche": "Health",
            "business_type": "Clinic",
            "terms_accepted": True,
            "privacy_accepted": True,
        }
        payload.update(overrides)
        return payload

    def test_customer_registration_requires_both_documents_and_records_current_versions(self):
        missing = self.customer_payload()
        missing.pop("privacy_accepted")
        rejected = self.client.post("/api/v1/customers/register/", missing, format="json")
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email=missing["email"]).exists())

        created = self.client.post("/api/v1/customers/register/", self.customer_payload(), format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="legal-customer@example.com")
        self.assertSetEqual(
            set(user.legal_acceptances.values_list("document_type", "document_version")),
            {("TERMS", TERMS_VERSION), ("PRIVACY", PRIVACY_VERSION)},
        )

    def test_company_registration_requires_acceptance_and_links_company(self):
        root = User.objects.create_superuser("legal-root@example.com", PASSWORD, full_name="Root")
        _, key = RegistrationKey.issue(root)
        rejected = self.client.post(
            "/api/v1/companies/register/",
            self.company_payload(key, terms_accepted=False),
            format="json",
        )
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Company.objects.filter(slug="legal-company").exists())

        _, valid_key = RegistrationKey.issue(root)
        created = self.client.post("/api/v1/companies/register/", self.company_payload(valid_key), format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        company = Company.objects.get(slug="legal-company")
        self.assertEqual(LegalAcceptance.objects.filter(company=company).count(), 2)

    def test_anonymous_booking_does_not_require_or_record_acceptance(self):
        _, company = create_company("legal-booking")
        service, professional, starts_at = create_booking_catalog(company)
        url = f"/api/v1/public/companies/{company.slug}/appointments/"
        payload = booking_payload(service, professional, starts_at)
        payload.pop("terms_accepted")
        payload.pop("privacy_accepted")
        created = self.client.post(url, payload, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertFalse(LegalAcceptance.objects.filter(appointment_id=created.data["id"]).exists())

    def test_client_cannot_choose_a_version_and_company_cannot_read_other_acceptances(self):
        created = self.client.post(
            "/api/v1/customers/register/",
            self.customer_payload(terms_version="1900-01-01", privacy_version="invalid"),
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertFalse(LegalAcceptance.objects.filter(document_version__in=("1900-01-01", "invalid")).exists())

        company_owner, _ = create_company("legal-reader")
        self.client.force_authenticate(company_owner)
        current = self.client.get("/api/v1/legal/current/")
        self.assertEqual(current.status_code, status.HTTP_200_OK)
        self.assertFalse(current.data["terms"]["accepted"])
        self.assertFalse(current.data["privacy"]["accepted"])
        self.assertNotIn("legal-customer@example.com", str(current.data))
        self.assertEqual(self.client.get("/api/v1/legal/acceptances/").status_code, status.HTTP_404_NOT_FOUND)
