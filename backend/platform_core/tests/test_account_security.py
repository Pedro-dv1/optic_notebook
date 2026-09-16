import hashlib
import io
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from urllib.error import HTTPError
from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import close_old_connections
from django.test import SimpleTestCase, TransactionTestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from accounts import email_service
from accounts.email_service import EmailDeliveryError
from accounts.models import AccountActionAuthorization, AccountVerificationChallenge, User

from .helpers import PASSWORD

NEW_PASSWORD = "Another-Correct-Horse-2026!"


class AccountSecurityFlowTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            "security@example.com",
            PASSWORD,
            full_name="Security Customer",
            whatsapp="+5511999999999",
        )
        self.client.force_authenticate(self.user)
        self.otp_sender = patch("accounts.account_security.email_service.send_security_otp").start()
        self.password_notice = patch("accounts.account_security.email_service.send_password_changed").start()
        self.email_notice = patch("accounts.account_security.email_service.send_email_changed").start()
        self.addCleanup(patch.stopall)

    def request_password_otp(self):
        return self.client.post("/api/v1/customers/security/password/request/", {}, format="json")

    def latest_code(self):
        return self.otp_sender.call_args.kwargs["code"]

    def authorize_password_change(self):
        requested = self.request_password_otp()
        verified = self.client.post(
            "/api/v1/customers/security/password/verify/",
            {"challenge_id": requested.data["challenge_id"], "code": self.latest_code()},
            format="json",
        )
        return requested, verified

    def authorize_email_change(self):
        requested = self.client.post(
            "/api/v1/customers/security/email-change/current/request/", {}, format="json"
        )
        verified = self.client.post(
            "/api/v1/customers/security/email-change/current/verify/",
            {"challenge_id": requested.data["challenge_id"], "code": self.latest_code()},
            format="json",
        )
        return verified.data["authorization_token"]

    def test_authenticated_request_stores_only_hash_and_unauthenticated_is_blocked(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.request_password_otp().status_code, status.HTTP_401_UNAUTHORIZED)
        self.client.force_authenticate(self.user)
        response = self.request_password_otp()
        code = self.latest_code()
        challenge = AccountVerificationChallenge.objects.get(pk=response.data["challenge_id"])
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(challenge.code_hash, code)
        self.assertNotIn(code, str(response.data))
        self.assertNotIn(challenge.code_hash, str(response.data))
        self.assertEqual(response.data["masked_email"], "se***@example.com")

    def test_correct_wrong_expired_used_and_attempt_limited_otps(self):
        requested = self.request_password_otp()
        url = "/api/v1/customers/security/password/verify/"
        wrong = {"challenge_id": requested.data["challenge_id"], "code": "000000"}
        if self.latest_code() == "000000":
            wrong["code"] = "999999"
        self.assertEqual(self.client.post(url, wrong, format="json").status_code, status.HTTP_400_BAD_REQUEST)

        challenge = AccountVerificationChallenge.objects.get(pk=requested.data["challenge_id"])
        challenge.expires_at = timezone.now() - timedelta(seconds=1)
        challenge.save(update_fields=("expires_at",))
        expired = self.client.post(url, {**wrong, "code": self.latest_code()}, format="json")
        self.assertEqual(expired.data["errors"]["code"], "otp_expired")

        challenge.delete()
        requested = self.request_password_otp()
        payload = {"challenge_id": requested.data["challenge_id"], "code": self.latest_code()}
        self.assertEqual(self.client.post(url, payload, format="json").status_code, status.HTTP_200_OK)
        replay = self.client.post(url, payload, format="json")
        self.assertEqual(replay.data["errors"]["code"], "otp_used")

        AccountVerificationChallenge.objects.filter(pk=requested.data["challenge_id"]).delete()
        requested = self.request_password_otp()
        wrong["challenge_id"] = requested.data["challenge_id"]
        wrong["code"] = "000000" if self.latest_code() != "000000" else "999999"
        responses = [self.client.post(url, wrong, format="json") for _ in range(5)]
        self.assertEqual(responses[-1].status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(responses[-1].data["errors"]["code"], "otp_attempts_exceeded")

    def test_cooldown_new_code_invalidation_and_database_rate_limit(self):
        first = self.request_password_otp()
        blocked = self.request_password_otp()
        self.assertEqual(blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn("Retry-After", blocked.headers)

        for _ in range(3):
            latest = AccountVerificationChallenge.objects.order_by("-created_at").first()
            AccountVerificationChallenge.objects.filter(pk=latest.pk).update(
                created_at=timezone.now() - timedelta(seconds=61),
                sent_at=timezone.now() - timedelta(seconds=61),
            )
            response = self.request_password_otp()
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        first_challenge = AccountVerificationChallenge.objects.get(pk=first.data["challenge_id"])
        self.assertIsNotNone(first_challenge.consumed_at)

        latest = AccountVerificationChallenge.objects.order_by("-created_at").first()
        AccountVerificationChallenge.objects.filter(pk=latest.pk).update(
            created_at=timezone.now() - timedelta(seconds=61),
            sent_at=timezone.now() - timedelta(seconds=61),
        )
        self.assertEqual(self.request_password_otp().status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_password_otp_cannot_authorize_email_change_or_another_user(self):
        requested = self.request_password_otp()
        payload = {"challenge_id": requested.data["challenge_id"], "code": self.latest_code()}
        mismatch = self.client.post(
            "/api/v1/customers/security/email-change/current/verify/", payload, format="json"
        )
        self.assertEqual(mismatch.status_code, status.HTTP_400_BAD_REQUEST)

        other = User.objects.create_user("other-security@example.com", PASSWORD, full_name="Other")
        self.client.force_authenticate(other)
        idor = self.client.post("/api/v1/customers/security/password/verify/", payload, format="json")
        self.assertEqual(idor.status_code, status.HTTP_400_BAD_REQUEST)
        challenge = AccountVerificationChallenge.objects.get(pk=requested.data["challenge_id"])
        self.assertEqual(challenge.failed_attempts, 0)

    def test_password_change_validates_hash_policy_grant_expiry_and_single_use(self):
        _, verified = self.authorize_password_change()
        token = verified.data["authorization_token"]
        weak = self.client.post(
            "/api/v1/customers/password/change/",
            {"authorization_token": token, "new_password": "123456789012", "new_password_confirm": "123456789012"},
            format="json",
        )
        self.assertEqual(weak.status_code, status.HTTP_400_BAD_REQUEST)

        grant = AccountActionAuthorization.objects.get(user=self.user)
        grant.expires_at = timezone.now() - timedelta(seconds=1)
        grant.save(update_fields=("expires_at",))
        expired = self.client.post(
            "/api/v1/customers/password/change/",
            {"authorization_token": token, "new_password": NEW_PASSWORD, "new_password_confirm": NEW_PASSWORD},
            format="json",
        )
        self.assertEqual(expired.data["errors"]["code"], "authorization_expired")

        grant.delete()
        AccountVerificationChallenge.objects.all().delete()
        _, verified = self.authorize_password_change()
        token = verified.data["authorization_token"]
        payload = {"authorization_token": token, "new_password": NEW_PASSWORD, "new_password_confirm": NEW_PASSWORD}
        changed = self.client.post("/api/v1/customers/password/change/", payload, format="json")
        self.assertEqual(changed.status_code, status.HTTP_204_NO_CONTENT)
        self.user.refresh_from_db()
        self.assertFalse(self.user.check_password(PASSWORD))
        self.assertTrue(self.user.check_password(NEW_PASSWORD))
        self.assertTrue(self.password_notice.called)
        reused = self.client.post(
            "/api/v1/customers/password/change/",
            {
                **payload,
                "new_password": "Third-Correct-Horse-2026!",
                "new_password_confirm": "Third-Correct-Horse-2026!",
            },
            format="json",
        )
        self.assertEqual(reused.data["errors"]["code"], "authorization_used")

    def test_password_change_invalidates_access_refresh_and_old_login(self):
        self.client.force_authenticate(user=None)
        login = self.client.post("/api/v1/auth/login/", {"email": self.user.email, "password": PASSWORD}, format="json")
        old_access = login.data["access"]
        old_refresh = login.cookies["obn_refresh"].value
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {old_access}")
        requested = self.request_password_otp()
        verified = self.client.post(
            "/api/v1/customers/security/password/verify/",
            {"challenge_id": requested.data["challenge_id"], "code": self.latest_code()},
            format="json",
        )
        changed = self.client.post(
            "/api/v1/customers/password/change/",
            {
                "authorization_token": verified.data["authorization_token"],
                "new_password": NEW_PASSWORD,
                "new_password_confirm": NEW_PASSWORD,
            },
            format="json",
        )
        self.assertEqual(changed.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, status.HTTP_401_UNAUTHORIZED)
        refresh_client = APIClient()
        refresh_client.cookies["obn_refresh"] = old_refresh
        self.assertEqual(refresh_client.post("/api/v1/auth/refresh/", {}, format="json").status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            APIClient().post("/api/v1/auth/login/", {"email": self.user.email, "password": PASSWORD}, format="json").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            APIClient().post("/api/v1/auth/login/", {"email": self.user.email, "password": NEW_PASSWORD}, format="json").status_code,
            status.HTTP_200_OK,
        )

    def test_email_change_requires_both_addresses_and_notifies_old_address(self):
        token = self.authorize_email_change()
        requested = self.client.post(
            "/api/v1/customers/security/email-change/new/request/",
            {"authorization_token": token, "new_email": "new-security@example.com"},
            format="json",
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "security@example.com")
        changed = self.client.post(
            "/api/v1/customers/security/email-change/new/verify/",
            {
                "authorization_token": token,
                "challenge_id": requested.data["challenge_id"],
                "code": self.latest_code(),
            },
            format="json",
        )
        self.assertEqual(changed.status_code, status.HTTP_204_NO_CONTENT)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "new-security@example.com")
        self.email_notice.assert_called_once_with(to="security@example.com", event_id=AccountActionAuthorization.objects.get(user=self.user).id)

    def test_email_change_rejects_missing_current_proof_and_duplicate_race_at_confirmation(self):
        invalid = self.client.post(
            "/api/v1/customers/security/email-change/new/request/",
            {"authorization_token": "x" * 43, "new_email": "other@example.com"},
            format="json",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

        token = self.authorize_email_change()
        requested = self.client.post(
            "/api/v1/customers/security/email-change/new/request/",
            {"authorization_token": token, "new_email": "claimed@example.com"},
            format="json",
        )
        User.objects.create_user("claimed@example.com", PASSWORD, full_name="Claimed")
        conflict = self.client.post(
            "/api/v1/customers/security/email-change/new/verify/",
            {
                "authorization_token": token,
                "challenge_id": requested.data["challenge_id"],
                "code": self.latest_code(),
            },
            format="json",
        )
        self.assertEqual(conflict.status_code, status.HTTP_409_CONFLICT)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "security@example.com")

    def test_email_delivery_failure_leaves_no_valid_challenge(self):
        self.otp_sender.side_effect = EmailDeliveryError("down", provider_status=403, provider_error="validation_error")
        with self.assertLogs("optic_notebook.security", level="WARNING") as logs:
            response = self.request_password_otp()
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(response.data["errors"]["code"], "email_delivery_unavailable")
        self.assertFalse(AccountVerificationChallenge.objects.filter(user=self.user).exists())
        self.assertNotIn("code_hash", str(response.data))
        self.assertIn("provider_status=403", logs.output[0])
        self.assertIn("provider_error=validation_error", logs.output[0])

    def test_profile_cannot_mass_assign_email_and_rejects_invalid_avatar(self):
        response = self.client.patch(
            "/api/v1/customers/profile/me/",
            {"email": "bypass@example.com", "full_name": "  Nome   Atualizado  ", "whatsapp": "(11) 99999-9999"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, "security@example.com")
        self.assertEqual(self.user.full_name, "Nome Atualizado")
        disguised = SimpleUploadedFile("avatar.png", b"<script>alert(1)</script>", content_type="image/png")
        invalid = self.client.patch("/api/v1/customers/profile/me/", {"avatar": disguised}, format="multipart")
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

        stream = io.BytesIO()
        Image.new("RGB", (8, 8), "blue").save(stream, format="PNG")
        valid = SimpleUploadedFile("../../avatar.exe", stream.getvalue(), content_type="application/octet-stream")
        with override_settings(STORAGES={"default": {"BACKEND": "django.core.files.storage.InMemoryStorage"}}):
            accepted = self.client.patch("/api/v1/customers/profile/me/", {"avatar": valid}, format="multipart")
        self.assertEqual(accepted.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.avatar.name.endswith(".png"))


class EmailServiceTests(SimpleTestCase):
    @override_settings(EMAIL_PROVIDER="resend", RESEND_API_KEY="secret", DEFAULT_FROM_EMAIL="Sender <sender@example.com>")
    @patch("accounts.email_service.request.urlopen")
    def test_resend_rejection_keeps_only_safe_provider_metadata(self, urlopen):
        body = json.dumps({"name": "validation_error", "message": "recipient details"}).encode()
        urlopen.side_effect = HTTPError("https://api.resend.com/emails", 403, "Forbidden", {}, io.BytesIO(body))
        with self.assertRaises(EmailDeliveryError) as raised:
            email_service.send_security_otp(
                to="security@example.com",
                purpose=AccountVerificationChallenge.Purpose.PASSWORD_CHANGE,
                code="123456",
                expires_minutes=10,
                event_id="event-id",
            )
        self.assertEqual(raised.exception.provider_status, 403)
        self.assertEqual(raised.exception.provider_error, "validation_error")
        self.assertNotIn("recipient details", str(raised.exception))


class EmailChangeConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.users = [
            User.objects.create_user(f"race-{index}@example.com", PASSWORD, full_name=f"Race {index}")
            for index in range(2)
        ]
        self.tokens = [f"token-{index}-" + "x" * 36 for index in range(2)]
        self.challenges = []
        for user, token in zip(self.users, self.tokens):
            authorization = AccountActionAuthorization.objects.create(
                user=user,
                purpose=AccountActionAuthorization.Purpose.EMAIL_CHANGE,
                token_digest=hashlib.sha256(token.encode()).hexdigest(),
                email_candidate="race-target@example.com",
                expires_at=timezone.now() + timedelta(minutes=10),
            )
            self.challenges.append(
                AccountVerificationChallenge.objects.create(
                    user=user,
                    purpose=AccountVerificationChallenge.Purpose.EMAIL_CHANGE_NEW,
                    code_hash=make_password("123456"),
                    target_email="race-target@example.com",
                    authorization=authorization,
                    expires_at=timezone.now() + timedelta(minutes=10),
                    sent_at=timezone.now(),
                )
            )

    @patch("accounts.account_security.email_service.send_email_changed")
    def test_only_one_concurrent_request_can_claim_the_same_email(self, _notice):
        def confirm(index):
            close_old_connections()
            client = APIClient()
            client.force_authenticate(self.users[index])
            response = client.post(
                "/api/v1/customers/security/email-change/new/verify/",
                {
                    "authorization_token": self.tokens[index],
                    "challenge_id": self.challenges[index].id,
                    "code": "123456",
                },
                format="json",
            )
            close_old_connections()
            return response.status_code

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(confirm, (0, 1)))
        self.assertCountEqual(results, [status.HTTP_204_NO_CONTENT, status.HTTP_409_CONFLICT])
        self.assertEqual(User.objects.filter(email="race-target@example.com").count(), 1)
