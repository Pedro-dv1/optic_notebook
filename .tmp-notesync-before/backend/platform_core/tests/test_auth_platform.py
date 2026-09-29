from concurrent.futures import ThreadPoolExecutor

from django.core.cache import cache
from django.db import close_old_connections
from django.test import TransactionTestCase, tag
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from companies.models import Company
from platform_core.models import RegistrationKey
from services.models import Service

from .helpers import PASSWORD, create_company


class AuthenticationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            email="customer@example.com",
            password=PASSWORD,
            full_name="Customer",
            whatsapp="+5511988887777",
        )

    def login(self, password=PASSWORD):
        return self.client.post("/api/v1/auth/login/", {"email": self.user.email, "password": password}, format="json")

    def test_login_and_me(self):
        response = self.login()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertNotIn("refresh", response.data)
        self.assertIn("obn_refresh", response.cookies)
        refresh_cookie = response.cookies["obn_refresh"]
        self.assertTrue(refresh_cookie["httponly"])
        self.assertEqual(refresh_cookie["samesite"], "Lax")
        self.assertEqual(refresh_cookie["path"], "/api/v1/auth/")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")
        me = self.client.get("/api/v1/auth/me/")
        self.assertEqual(me.status_code, status.HTTP_200_OK)
        self.assertEqual(me.data["email"], self.user.email)
        self.assertNotIn("password", me.data)

    def test_invalid_password_is_rejected_generically(self):
        response = self.login("wrong-password")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn(self.user.email, str(response.data))

    def test_protected_endpoint_without_token_is_rejected(self):
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_token_is_rejected(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer invalid.jwt.token")
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, status.HTTP_401_UNAUTHORIZED)

    def test_customer_registration_duplicate_email_uses_generic_error(self):
        response = self.client.post(
            "/api/v1/customers/register/",
            {
                "email": self.user.email,
                "password": PASSWORD,
                "full_name": "Duplicate",
                "whatsapp": "+5511988887777",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertNotIn(self.user.email, str(response.data))
        self.assertEqual(User.objects.filter(email=self.user.email).count(), 1)

    def test_customer_registration_requires_a_valid_whatsapp(self):
        base = {
            "email": "new-customer@example.com",
            "password": PASSWORD,
            "full_name": "New Customer",
        }
        missing = self.client.post("/api/v1/customers/register/", base, format="json")
        invalid = self.client.post(
            "/api/v1/customers/register/",
            base | {"whatsapp": "not-a-phone"},
            format="json",
        )
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email=base["email"]).exists())

    def test_refresh_rotates_and_blacklists_previous_refresh(self):
        login = self.login()
        old_refresh = login.cookies["obn_refresh"].value
        refreshed = self.client.post("/api/v1/auth/refresh/", {}, format="json")
        self.assertEqual(refreshed.status_code, status.HTTP_200_OK)
        self.assertNotIn("refresh", refreshed.data)
        self.assertNotEqual(refreshed.cookies["obn_refresh"].value, old_refresh)
        replay = APIClient()
        replay.cookies["obn_refresh"] = old_refresh
        reused = replay.post("/api/v1/auth/refresh/", {}, format="json")
        self.assertEqual(reused.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_blacklists_refresh(self):
        login = self.login()
        old_refresh = login.cookies["obn_refresh"].value
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        logout = self.client.post("/api/v1/auth/logout/", {}, format="json")
        self.assertEqual(logout.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(logout.cookies["obn_refresh"]["max-age"], 0)
        self.client.credentials()
        self.client.cookies["obn_refresh"] = old_refresh
        reused = self.client.post("/api/v1/auth/refresh/", {}, format="json")
        self.assertEqual(reused.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_cannot_blacklist_another_users_refresh(self):
        other = User.objects.create_user("other@example.com", PASSWORD, full_name="Other")
        own_login = self.login()
        other_client = APIClient()
        other_login = other_client.post(
            "/api/v1/auth/login/", {"email": other.email, "password": PASSWORD}, format="json"
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {own_login.data['access']}")
        self.client.cookies["obn_refresh"] = other_login.cookies["obn_refresh"].value
        rejected = self.client.post("/api/v1/auth/logout/", {}, format="json")
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.client.credentials()
        other_client.cookies["obn_refresh"] = other_login.cookies["obn_refresh"].value
        still_valid = other_client.post("/api/v1/auth/refresh/", {}, format="json")
        self.assertEqual(still_valid.status_code, status.HTTP_200_OK)


class PlatformAndRegistrationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.superuser = User.objects.create_superuser("root@example.com", PASSWORD, full_name="Root")
        self.common_user = User.objects.create_user("common@example.com", PASSWORD, full_name="Common")

    def issue_key(self):
        self.client.force_authenticate(self.superuser)
        response = self.client.post("/api/v1/platform/registration-keys/", {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data["authorization_key"]

    def registration_payload(self, key, suffix="one"):
        return {
            "authorization_key": key,
            "owner_email": f"new-owner-{suffix}@example.com",
            "owner_password": PASSWORD,
            "owner_name": "New Owner",
            "owner_whatsapp": "+5511977776666",
            "name": f"New Company {suffix}",
            "slug": f"new-company-{suffix}",
            "tax_identifier": "12.345.678/0001-90",
            "whatsapp": "+5511966665555",
            "address": "Main Street",
            "city": "Jales",
            "state": "SP",
            "niche": "Beauty",
            "business_type": "Salon",
            "terms_accepted": True,
            "privacy_accepted": True,
        }

    def test_superuser_generates_key_and_secret_is_not_persisted_or_listed(self):
        secret = self.issue_key()
        key = RegistrationKey.objects.get()
        self.assertNotEqual(key.digest, secret)
        listing = self.client.get("/api/v1/platform/registration-keys/")
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        serialized = str(listing.data)
        self.assertNotIn(secret, serialized)
        self.assertNotIn(key.digest, serialized)

    def test_common_user_cannot_generate_key_or_list_companies(self):
        self.client.force_authenticate(self.common_user)
        self.assertEqual(self.client.post("/api/v1/platform/registration-keys/", {}).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get("/api/v1/platform/companies/").status_code, status.HTTP_403_FORBIDDEN)

    def test_company_registration_consumes_key_atomically(self):
        secret = self.issue_key()
        self.client.force_authenticate(user=None)
        response = self.client.post("/api/v1/companies/register/", self.registration_payload(secret), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        company = Company.objects.get(slug="new-company-one")
        key = RegistrationKey.objects.get()
        self.assertEqual(key.consumed_by_company, company)
        self.assertFalse(key.is_active)
        self.assertTrue(User.objects.filter(email="new-owner-one@example.com").exists())
        login = self.client.post(
            "/api/v1/auth/login/",
            {"email": "new-owner-one@example.com", "password": PASSWORD},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertEqual(login.data["user"]["company"]["status"], Company.Status.ACTIVE)

    def test_company_registration_rejects_business_type_from_another_niche(self):
        secret = self.issue_key()
        self.client.force_authenticate(user=None)
        response = self.client.post(
            "/api/v1/companies/register/",
            self.registration_payload(secret) | {"niche": "Health", "business_type": "Barbershop"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("business_type", response.data["errors"])
        self.assertFalse(Company.objects.exists())

    def test_invalid_and_reused_keys_are_rejected_without_partial_state(self):
        invalid = self.client.post(
            "/api/v1/companies/register/",
            self.registration_payload("obn_rk_" + "x" * 43),
            format="json",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Company.objects.exists())
        secret = self.issue_key()
        self.client.force_authenticate(user=None)
        self.assertEqual(
            self.client.post("/api/v1/companies/register/", self.registration_payload(secret), format="json").status_code,
            status.HTTP_201_CREATED,
        )
        reused = self.client.post(
            "/api/v1/companies/register/",
            self.registration_payload(secret, "two") | {"tax_identifier": "98.765.432/0001-10"},
            format="json",
        )
        self.assertEqual(reused.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Company.objects.filter(slug="new-company-two").exists())
        self.assertFalse(User.objects.filter(email="new-owner-two@example.com").exists())

    def test_superuser_lists_suspends_and_reactivates_company_without_data_loss(self):
        _, company = create_company("platform")
        service = Service.objects.create(company=company, name="Kept", duration="00:30:00")
        self.client.force_authenticate(self.superuser)
        listing = self.client.get("/api/v1/platform/companies/")
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data["count"], 1)
        suspended = self.client.post(f"/api/v1/platform/companies/{company.id}/suspend/")
        self.assertEqual(suspended.status_code, status.HTTP_200_OK)
        company.refresh_from_db()
        self.assertEqual(company.status, Company.Status.SUSPENDED)
        self.assertTrue(Service.objects.filter(pk=service.pk).exists())
        reactivated = self.client.post(f"/api/v1/platform/companies/{company.id}/reactivate/")
        self.assertEqual(reactivated.status_code, status.HTTP_200_OK)
        company.refresh_from_db()
        self.assertEqual(company.status, Company.Status.ACTIVE)


@tag("adversarial_2")
class RegistrationConcurrencyTests(TransactionTestCase):
    reset_sequences = True

    def test_same_authorization_key_cannot_be_consumed_twice(self):
        superuser = User.objects.create_superuser("race-root@example.com", PASSWORD, full_name="Root")
        _, secret = RegistrationKey.issue(superuser)

        def register(suffix):
            close_old_connections()
            client = APIClient()
            payload = PlatformAndRegistrationTests.registration_payload(None, secret, suffix)
            payload["tax_identifier"] = f"1234567890{suffix:04d}"
            response = client.post("/api/v1/companies/register/", payload, format="json")
            close_old_connections()
            return response.status_code

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(register, (1, 2)))

        self.assertCountEqual(results, [status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST])
        self.assertEqual(Company.objects.count(), 1)
        self.assertEqual(User.objects.filter(is_superuser=False).count(), 1)
