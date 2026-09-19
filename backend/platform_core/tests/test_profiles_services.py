import io
import uuid
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from bookings.models import Appointment
from companies.models import Company
from professionals.models import Professional
from services.models import Service

from .helpers import PASSWORD, create_booking_catalog, create_company


class CompanyServiceContractTests(APITestCase):
    def setUp(self):
        self.owner, self.company = create_company("service-contract")
        _, self.other_company = create_company("service-other")
        self.first = Professional.objects.create(company=self.company, name="First")
        self.second = Professional.objects.create(company=self.company, name="Second")
        self.other = Professional.objects.create(company=self.other_company, name="Other tenant")
        self.client.force_authenticate(self.owner)

    def create(self, **overrides):
        payload = {"name": f"Service {uuid.uuid4()}", "duration": "00:30:00", "is_active": True}
        payload.update(overrides)
        return self.client.post("/api/v1/company/services/", payload, format="json")

    def test_service_can_be_created_without_professional_and_edited(self):
        created = self.create(slot_interval="00:10:00")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        service = Service.objects.get(pk=created.data["id"])
        self.assertEqual(service.company, self.company)
        self.assertEqual(service.professionals.count(), 0)
        self.assertEqual(service.slot_interval, timedelta(minutes=10))
        updated = self.client.patch(
            f"/api/v1/company/services/{service.id}/",
            {"name": "Edited service", "is_active": False},
            format="json",
        )
        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        service.refresh_from_db()
        self.assertEqual((service.name, service.is_active), ("Edited service", False))

    def test_service_rejects_invalid_slot_intervals(self):
        for value in ("00:00:00", "24:01:00", "00:05:30"):
            with self.subTest(value=value):
                response = self.create(slot_interval=value)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn("slot_interval", response.data["errors"])

    def test_service_accepts_one_or_multiple_current_company_professionals(self):
        one = self.create(professional_ids=[str(self.first.id)])
        many = self.create(professional_ids=[str(self.first.id), str(self.second.id)])
        self.assertEqual(one.status_code, status.HTTP_201_CREATED)
        self.assertEqual(many.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Service.objects.get(pk=one.data["id"]).professionals.count(), 1)
        self.assertEqual(Service.objects.get(pk=many.data["id"]).professionals.count(), 2)

    def test_service_rejects_missing_or_other_tenant_professional_with_field_message(self):
        for professional_id in (str(uuid.uuid4()), str(self.other.id)):
            response = self.create(professional_ids=[professional_id])
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertEqual(
                str(response.data["errors"]["professional_ids"][0]),
                "Selecione um profissional válido desta empresa.",
            )

    def test_professional_endpoint_returns_current_company_ids(self):
        response = self.client.get("/api/v1/company/professionals/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({item["id"] for item in response.data["results"]}, {str(self.first.id), str(self.second.id)})


class CompanyCustomLabelTests(APITestCase):
    def setUp(self):
        self.owner, self.company = create_company("custom-label")
        self.client.force_authenticate(self.owner)

    def test_other_requires_custom_values_and_public_api_exposes_them(self):
        missing = self.client.patch(
            "/api/v1/company/profile/",
            {"niche": Company.Niche.OTHER, "business_type": Company.BusinessType.OTHER},
            format="json",
        )
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        valid = self.client.patch(
            "/api/v1/company/profile/",
            {
                "niche": Company.Niche.OTHER,
                "niche_custom": "  Fisioterapia esportiva  ",
                "business_type": Company.BusinessType.OTHER,
                "business_type_custom": "Centro especializado",
            },
            format="json",
        )
        self.assertEqual(valid.status_code, status.HTTP_200_OK)
        public = self.client.get(f"/api/v1/public/companies/{self.company.slug}/")
        self.assertEqual(public.data["niche_label"], "Fisioterapia esportiva")
        self.assertEqual(public.data["business_type_label"], "Centro especializado")

        reset = self.client.patch(
            "/api/v1/company/profile/",
            {"niche": Company.Niche.HEALTH, "business_type": Company.BusinessType.MEDICAL_CLINIC},
            format="json",
        )
        self.assertEqual(reset.status_code, status.HTTP_200_OK)
        self.company.refresh_from_db()
        self.assertEqual((self.company.niche_custom, self.company.business_type_custom), ("", ""))


class CustomerProfileSecurityTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(
            "profile-security@example.com", PASSWORD, full_name="Profile Customer", whatsapp="+5511999999999"
        )
        self.client.force_authenticate(self.customer)

    def image(self):
        stream = io.BytesIO()
        Image.new("RGB", (32, 32), "blue").save(stream, format="PNG")
        return SimpleUploadedFile("../../avatar.png", stream.getvalue(), content_type="image/png")

    def test_customer_updates_profile_avatar_and_company_admin_can_see_it(self):
        with override_settings(STORAGES={"default": {"BACKEND": "django.core.files.storage.InMemoryStorage"}}):
            response = self.client.patch(
                "/api/v1/customers/profile/me/",
                {"full_name": "Updated Customer", "avatar": self.image()},
                format="multipart",
            )
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.customer.refresh_from_db()
            self.assertTrue(self.customer.avatar.name.startswith(f"customer-avatars/{self.customer.id}/"))

            owner, company = create_company("avatar-admin")
            service, professional, starts_at = create_booking_catalog(company)
            Appointment.objects.create(
                company=company,
                service=service,
                professional=professional,
                starts_at=starts_at,
                ends_at=starts_at + service.duration,
                customer=self.customer,
                customer_name=self.customer.full_name,
                customer_email=self.customer.email,
                customer_whatsapp=self.customer.whatsapp,
            )
            self.client.force_authenticate(owner)
            customers = self.client.get("/api/v1/company/customers/")
            self.assertIn("customer-avatars", customers.data["results"][0]["avatar"])

            self.client.force_authenticate(self.customer)
            removed = self.client.patch("/api/v1/customers/profile/me/", {"avatar": None}, format="json")
            self.assertEqual(removed.status_code, status.HTTP_200_OK)
            self.customer.refresh_from_db()
            self.assertFalse(self.customer.avatar)

    def test_legacy_password_payload_cannot_bypass_email_verification(self):
        response = self.client.post(
            "/api/v1/customers/password/change/",
            {"current_password": PASSWORD, "new_password": "Different-password-2026", "new_password_confirm": "Different-password-2026"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("authorization_token", response.data["errors"])
        self.customer.refresh_from_db()
        self.assertTrue(self.customer.check_password(PASSWORD))

    def test_avatar_rejects_excessive_dimensions_even_when_file_is_small(self):
        stream = io.BytesIO()
        Image.new("RGB", (5000, 1), "blue").save(stream, format="PNG")
        upload = SimpleUploadedFile("wide.png", stream.getvalue(), content_type="image/png")
        response = self.client.patch("/api/v1/customers/profile/me/", {"avatar": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("avatar", response.data["errors"])

    def test_company_account_cannot_use_customer_profile_routes(self):
        owner, _ = create_company("not-customer")
        self.client.force_authenticate(owner)
        self.assertEqual(self.client.get("/api/v1/customers/profile/me/").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/api/v1/customers/appointments/").status_code, status.HTTP_403_FORBIDDEN)
