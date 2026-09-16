from io import BytesIO
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings, tag
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from bookings.models import Appointment
from companies.models import Company
from platform_core.models import RegistrationKey

from .helpers import PASSWORD, booking_payload, create_booking_catalog, create_company


def siteverify_response(payload):
    response = MagicMock()
    response.read.return_value = __import__("json").dumps(payload).encode()
    response.__enter__.return_value = response
    return response


class BrowserAuthenticationContractTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user("browser@example.com", PASSWORD, full_name="Browser")

    def test_csrf_is_required_for_cookie_session_operations(self):
        client = APIClient(enforce_csrf_checks=True)
        payload = {"email": self.user.email, "password": PASSWORD}
        self.assertEqual(client.post("/api/v1/auth/login/", payload, format="json").status_code, status.HTTP_403_FORBIDDEN)
        csrf = client.get("/api/v1/auth/csrf/")
        self.assertEqual(csrf.status_code, status.HTTP_204_NO_CONTENT)
        token = client.cookies["csrftoken"].value
        login = client.post("/api/v1/auth/login/", payload, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertEqual(client.post("/api/v1/auth/refresh/", {}, format="json").status_code, status.HTTP_403_FORBIDDEN)
        refreshed = client.post("/api/v1/auth/refresh/", {}, format="json", HTTP_X_CSRFTOKEN=token)
        self.assertEqual(refreshed.status_code, status.HTTP_200_OK)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refreshed.data['access']}")
        self.assertEqual(client.post("/api/v1/auth/logout/", {}, format="json").status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(client.post("/api/v1/auth/logout/", {}, format="json", HTTP_X_CSRFTOKEN=token).status_code, status.HTTP_204_NO_CONTENT)

    @override_settings(REFRESH_COOKIE_SECURE=True)
    def test_production_refresh_cookie_is_secure(self):
        response = self.client.post("/api/v1/auth/login/", {"email": self.user.email, "password": PASSWORD}, format="json")
        cookie = response.cookies["obn_refresh"]
        self.assertTrue(cookie["secure"])
        self.assertTrue(cookie["httponly"])

    @override_settings(CORS_ALLOWED_ORIGINS=["https://app.example.test"])
    def test_cors_only_echoes_an_allowed_origin(self):
        allowed = self.client.options("/api/v1/auth/login/", HTTP_ORIGIN="https://app.example.test")
        rejected = self.client.options("/api/v1/auth/login/", HTTP_ORIGIN="https://evil.example")
        self.assertEqual(allowed.headers.get("Access-Control-Allow-Origin"), "https://app.example.test")
        self.assertIsNone(rejected.headers.get("Access-Control-Allow-Origin"))


@override_settings(TURNSTILE_REQUIRED=True, TURNSTILE_SECRET_KEY="test-secret", TURNSTILE_EXPECTED_HOSTNAMES=["testserver"])
class TurnstileValidationTests(APITestCase):
    def setUp(self):
        cache.clear()

    @patch("platform_core.turnstile.urlrequest.urlopen")
    def test_valid_token_is_verified_server_side_and_replay_is_rejected(self, mocked):
        mocked.return_value = siteverify_response({"success": True, "hostname": "testserver", "action": "customer_registration"})
        payload = {"email": "turnstile@example.com", "password": PASSWORD, "full_name": "Turnstile", "whatsapp": "+5511988887777", "turnstile_token": "valid-once"}
        created = self.client.post("/api/v1/customers/register/", payload, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        replay = self.client.post("/api/v1/customers/register/", payload | {"email": "other@example.com"}, format="json")
        self.assertEqual(replay.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(mocked.call_count, 1)

    @patch("platform_core.turnstile.urlrequest.urlopen")
    def test_missing_invalid_and_expired_tokens_fail_closed(self, mocked):
        base = {"email": "blocked@example.com", "password": PASSWORD, "full_name": "Blocked", "whatsapp": "+5511988887777"}
        self.assertEqual(self.client.post("/api/v1/customers/register/", base, format="json").status_code, status.HTTP_400_BAD_REQUEST)
        mocked.return_value = siteverify_response({"success": False, "error-codes": ["timeout-or-duplicate"]})
        invalid = self.client.post("/api/v1/customers/register/", base | {"turnstile_token": "expired"}, format="json")
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="blocked@example.com").exists())

    def test_honeypot_rejects_even_when_turnstile_is_present(self):
        response = self.client.post("/api/v1/auth/login/", {"email": "x@example.com", "password": PASSWORD, "website": "https://spam.example", "turnstile_token": "unused"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@tag("adversarial_2")
class PublicInputAndUploadTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.company = create_company("frontend-security")
        self.service, self.professional, self.starts_at = create_booking_catalog(self.company)

    def test_reserved_slugs_are_rejected_and_legacy_theme_fields_are_not_writable(self):
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch("/api/v1/company/profile/", {"slug": "platform"}, format="json").status_code, status.HTTP_400_BAD_REQUEST)
        attack = self.client.patch("/api/v1/company/profile/", {"theme_accent": "url(javascript:alert(1))", "status": "SUSPENDED", "owner": "00000000-0000-0000-0000-000000000000"}, format="json")
        self.assertEqual(attack.status_code, status.HTTP_200_OK)
        self.assertNotIn("theme_accent", attack.data)
        self.company.refresh_from_db()
        self.assertEqual(self.company.status, Company.Status.ACTIVE)
        self.assertEqual(self.company.owner, self.owner)
        self.assertEqual(self.company.theme_accent, "#2F80ED")

    def test_html_svg_disguised_and_large_logos_are_rejected(self):
        self.client.force_authenticate(self.owner)
        for filename, content, content_type in (
            ("logo.png", b"<html><script>alert(1)</script></html>", "image/png"),
            ("logo.svg", b"<svg xmlns='http://www.w3.org/2000/svg'></svg>", "image/svg+xml"),
            ("../logo.png", b"not an image", "image/png"),
        ):
            upload = SimpleUploadedFile(filename, content, content_type=content_type)
            response = self.client.patch("/api/v1/company/profile/", {"logo": upload}, format="multipart")
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        large = SimpleUploadedFile("large.png", b"0" * (2 * 1024 * 1024 + 1), content_type="image/png")
        self.assertEqual(self.client.patch("/api/v1/company/profile/", {"logo": large}, format="multipart").status_code, status.HTTP_400_BAD_REQUEST)
        self.company.refresh_from_db()
        self.assertFalse(self.company.logo)

    def test_real_png_is_accepted_with_server_generated_path(self):
        self.client.force_authenticate(self.owner)
        stream = BytesIO()
        Image.new("RGB", (8, 8), color="navy").save(stream, format="PNG")
        upload = SimpleUploadedFile("../../customer-name.png", stream.getvalue(), content_type="image/png")
        response = self.client.patch("/api/v1/company/profile/", {"logo": upload}, format="multipart")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.company.refresh_from_db()
        self.assertTrue(self.company.logo.name.startswith(f"company-logos/{self.company.id}/"))
        self.assertNotIn("customer-name", self.company.logo.name)
        self.company.logo.delete(save=False)

    def test_valid_image_under_2_mb_is_not_rejected_by_dimensions(self):
        self.client.force_authenticate(self.owner)
        stream = BytesIO()
        Image.new("RGB", (5000, 100), color="navy").save(stream, format="JPEG")
        upload = SimpleUploadedFile("wide.jfif", stream.getvalue(), content_type="image/jpeg")
        with override_settings(STORAGES={"default": {"BACKEND": "django.core.files.storage.InMemoryStorage"}}):
            response = self.client.patch("/api/v1/company/profile/", {"logo": upload}, format="multipart")
        self.assertLess(upload.size, 2 * 1024 * 1024)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["logo"].endswith(".jpg"))

    def test_public_search_exposes_only_active_public_fields(self):
        create_company("hidden", status=Company.Status.SUSPENDED)
        response = self.client.get("/api/v1/public/companies/", {"q": "Company"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            set(response.data["results"][0]),
            {
                "name", "slug", "city", "state", "niche", "niche_label",
                "business_type", "business_type_label", "address", "public_notes", "logo",
            },
        )

    def test_booking_xss_is_stored_as_text_without_privileged_assignment(self):
        payload = booking_payload(self.service, self.professional, self.starts_at, customer_name="<script>alert(1)</script>", customer_notes="<img src=x onerror=alert(1)>")
        payload |= {"company": "00000000-0000-0000-0000-000000000000", "status": "CONFIRMED"}
        response = self.client.post(f"/api/v1/public/companies/{self.company.slug}/appointments/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        appointment = Appointment.objects.get()
        self.assertEqual(appointment.company, self.company)
        self.assertEqual(appointment.status, Appointment.Status.WAITING_CONFIRMATION)
        self.assertEqual(appointment.customer_name, "<script>alert(1)</script>")

    def test_company_customer_endpoint_does_not_leak_other_tenants(self):
        other_owner, other_company = create_company("customer-list-other")
        other_service, other_professional, other_start = create_booking_catalog(other_company)
        Appointment.objects.create(company=other_company, service=other_service, professional=other_professional, starts_at=other_start, ends_at=other_start + other_service.duration, customer_name="Other Tenant", customer_email="other@secret.test", customer_whatsapp="+5511999999999")
        self.client.force_authenticate(self.owner)
        response = self.client.get("/api/v1/company/customers/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("other@secret.test", str(response.data))
        self.client.force_authenticate(other_owner)
        self.assertIn("other@secret.test", str(self.client.get("/api/v1/company/customers/").data))


@tag("adversarial_2")
class ScopedRateLimitTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.company = create_company("rate-limits")
        self.service, self.professional, self.starts_at = create_booking_catalog(self.company)

    def test_company_registration_rate_limit_is_distinct(self):
        payload = {"authorization_key": "obn_rk_" + "x" * 43, "owner_email": "rate@example.com", "owner_password": PASSWORD, "owner_name": "Rate", "name": "Rate", "slug": "rate-company", "whatsapp": "+5511988887777", "niche": "Test", "business_type": "Test"}
        responses = [self.client.post("/api/v1/companies/register/", payload, format="json").status_code for _ in range(4)]
        self.assertEqual(responses[:3], [status.HTTP_400_BAD_REQUEST] * 3)
        self.assertEqual(responses[3], status.HTTP_429_TOO_MANY_REQUESTS)

    def test_anonymous_booking_rate_limit_returns_retry_after(self):
        url = f"/api/v1/public/companies/{self.company.slug}/appointments/"
        responses = [self.client.post(url, booking_payload(self.service, self.professional, self.starts_at), format="json") for _ in range(11)]
        self.assertEqual(responses[-1].status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("Retry-After", responses[-1].headers)
        self.assertEqual(Appointment.objects.count(), 1)
