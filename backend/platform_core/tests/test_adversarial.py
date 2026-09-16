from datetime import timedelta

from django.core.cache import cache
from django.test import tag
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from bookings.models import Appointment
from companies.models import Company
from platform_core.models import RegistrationKey
from services.models import Service

from .helpers import PASSWORD, booking_payload, create_booking_catalog, create_company


@tag("adversarial_1")
class AuthorizationAttackRoundTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner_a, self.company_a = create_company("attack-a")
        self.owner_b, self.company_b = create_company("attack-b")
        self.service_a, self.professional_a, self.starts_a = create_booking_catalog(self.company_a)
        self.service_b, self.professional_b, self.starts_b = create_booking_catalog(self.company_b)
        self.customer_a = User.objects.create_user(
            "attack-customer-a@example.com", PASSWORD, full_name="Customer A", whatsapp="+5511911111111"
        )
        self.customer_b = User.objects.create_user(
            "attack-customer-b@example.com", PASSWORD, full_name="Customer B", whatsapp="+5511922222222"
        )
        self.booking_b = Appointment.objects.create(
            company=self.company_b,
            service=self.service_b,
            professional=self.professional_b,
            starts_at=self.starts_b,
            ends_at=self.starts_b + self.service_b.duration,
            customer=self.customer_b,
            customer_name="Customer B",
            customer_email=self.customer_b.email,
            customer_whatsapp=self.customer_b.whatsapp,
        )

    def test_authorization_attack_matrix_fails_closed_and_preserves_state(self):
        self.client.force_authenticate(self.owner_a)
        service_url = f"/api/v1/company/services/{self.service_b.id}/"
        self.assertEqual(self.client.get(service_url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.patch(service_url, {"name": "Compromised"}, format="json").status_code, status.HTTP_404_NOT_FOUND)
        appointment_url = f"/api/v1/company/appointments/{self.booking_b.id}/"
        self.assertEqual(self.client.post(f"{appointment_url}confirm/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.post("/api/v1/platform/registration-keys/", {}).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.customer_a)
        customer_url = f"/api/v1/customers/appointments/{self.booking_b.id}/"
        self.assertEqual(self.client.get(customer_url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.post(f"{customer_url}cancel/").status_code, status.HTTP_404_NOT_FOUND)

        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get("/api/v1/company/services/").status_code, status.HTTP_401_UNAUTHORIZED)

        self.company_a.status = Company.Status.SUSPENDED
        self.company_a.save(update_fields=("status", "updated_at"))
        self.client.force_authenticate(self.owner_a)
        self.assertEqual(
            self.client.post("/api/v1/company/services/", {"name": "Blocked", "duration": "00:30:00"}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )

        self.service_b.refresh_from_db()
        self.booking_b.refresh_from_db()
        self.assertEqual(self.service_b.name, "Consultation")
        self.assertEqual(self.booking_b.status, Appointment.Status.WAITING_CONFIRMATION)
        self.assertFalse(Service.objects.filter(company=self.company_a, name="Blocked").exists())


@tag("adversarial_2")
class InputAuthenticationCredentialAttackRoundTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.superuser = User.objects.create_superuser("attack-root@example.com", PASSWORD, full_name="Root")
        self.owner, self.company = create_company("input-attack")
        self.service, self.professional, self.starts_at = create_booking_catalog(self.company)
        self.customer = User.objects.create_user(
            "input-customer@example.com", PASSWORD, full_name="Input Customer", whatsapp="+5511933333333"
        )

    def company_registration_payload(self, key, suffix):
        return {
            "authorization_key": key,
            "owner_email": f"credential-{suffix}@example.com",
            "owner_password": PASSWORD,
            "owner_name": "Credential Owner",
            "owner_whatsapp": "+5511955554444",
            "name": f"Credential Company {suffix}",
            "slug": f"credential-company-{suffix}",
            "whatsapp": "+5511944444444",
            "city": "Jales",
            "state": "SP",
            "niche": "Health",
            "business_type": "Clinic",
        }

    def test_key_replay_and_duplicate_consumption_preserve_state(self):
        _, secret = RegistrationKey.issue(self.superuser)
        first = self.client.post(
            "/api/v1/companies/register/", self.company_registration_payload(secret, "first"), format="json"
        )
        second = self.client.post(
            "/api/v1/companies/register/", self.company_registration_payload(secret, "second"), format="json"
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Company.objects.filter(slug__startswith="credential-company-").count(), 1)
        self.assertFalse(User.objects.filter(email="credential-second@example.com").exists())

    def test_tampered_jwt_and_blacklisted_refresh_are_rejected(self):
        login = self.client.post(
            "/api/v1/auth/login/", {"email": self.customer.email, "password": PASSWORD}, format="json"
        )
        access = login.data["access"]
        refresh = login.cookies["obn_refresh"].value
        header, payload, signature = access.split(".")
        tampered_signature = f"{'a' if signature[0] != 'a' else 'b'}{signature[1:]}"
        tampered = ".".join((header, payload, tampered_signature))
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {tampered}")
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, status.HTTP_401_UNAUTHORIZED)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(
            self.client.post("/api/v1/auth/logout/", {}, format="json").status_code,
            status.HTTP_204_NO_CONTENT,
        )
        self.client.credentials()
        self.client.cookies["obn_refresh"] = refresh
        self.assertEqual(
            self.client.post("/api/v1/auth/refresh/", {}, format="json").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_invalid_management_token_and_injection_inputs_do_not_corrupt_state(self):
        url = f"/api/v1/public/companies/{self.company.slug}/appointments/"
        payload = booking_payload(
            self.service,
            self.professional,
            self.starts_at,
            customer_name="' OR 1=1 --",
            customer_notes="'; DROP TABLE bookings_appointment; --",
        )
        created = self.client.post(url, payload, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        appointment = Appointment.objects.get(company=self.company)
        self.assertEqual(appointment.customer_name, "' OR 1=1 --")
        invalid_cancel = self.client.post(
            f"/api/v1/public/companies/{self.company.slug}/appointments/cancel/",
            {"management_token": "obn_appt_" + "z" * 43},
            format="json",
        )
        self.assertEqual(invalid_cancel.status_code, status.HTTP_404_NOT_FOUND)
        injection_query = self.client.get(
            f"/api/v1/public/companies/{self.company.slug}/availability/",
            {"service": "' OR 1=1 --", "date": self.starts_at.date().isoformat()},
        )
        self.assertEqual(injection_query.status_code, status.HTTP_400_BAD_REQUEST)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, Appointment.Status.WAITING_CONFIRMATION)
        self.assertEqual(Appointment.objects.count(), 1)

    def test_unexpected_privileged_fields_cannot_be_mass_assigned(self):
        other_owner, other_company = create_company("mass-target")
        self.client.force_authenticate(self.owner)
        response = self.client.post(
            "/api/v1/company/services/",
            {
                "name": "Safe",
                "duration": "00:30:00",
                "company": str(other_company.id),
                "owner": str(other_owner.id),
                "status": "SUSPENDED",
                "is_superuser": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Service.objects.get(name="Safe")
        self.assertEqual(created.company, self.company)
        self.assertFalse(self.owner.is_superuser)
        other_company.refresh_from_db()
        self.assertEqual(other_company.status, Company.Status.ACTIVE)

    def test_sensitive_endpoint_has_basic_throttling(self):
        cache.clear()
        responses = [
            self.client.post(
                "/api/v1/auth/login/",
                {"email": self.customer.email, "password": "definitely-wrong"},
                format="json",
            ).status_code
            for _ in range(6)
        ]
        self.assertEqual(responses[:5], [status.HTTP_401_UNAUTHORIZED] * 5)
        self.assertEqual(responses[5], status.HTTP_429_TOO_MANY_REQUESTS)
