from datetime import timedelta
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import patch

from django.core.cache import cache
from django.db import close_old_connections
from django.test import SimpleTestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory, APITestCase
from pywebpush import WebPushException

from accounts.models import User
from bookings.models import (
    Appointment, AppointmentOutcomeEvent, BookingPushSubscription, NotificationEvent,
    PushSubscription, Review, ReviewCredential,
)
from bookings.notifications import process_due_notifications
from bookings.views import PushConfigView
from professionals.models import ProfessionalAccessInvite, ProfessionalUnavailability

from .helpers import PASSWORD, booking_payload, create_booking_catalog, create_company


class PushConfigTests(SimpleTestCase):
    @override_settings(WEB_PUSH_VAPID_PUBLIC_KEY="public", WEB_PUSH_VAPID_PRIVATE_KEY="", WEB_PUSH_VAPID_SUBJECT="mailto:admin@example.com")
    def test_does_not_offer_subscription_without_private_key(self):
        response = PushConfigView.as_view()(APIRequestFactory().get("/api/v1/push/config/"))
        self.assertEqual(response.data, {"public_key": ""})


class OperationsV2Tests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.company = create_company("v2-a")
        self.service, self.professional, self.starts_at = create_booking_catalog(self.company, day_offset=3)
        self.other_owner, self.other_company = create_company("v2-b")
        self.other_service, self.other_professional, self.other_start = create_booking_catalog(self.other_company, day_offset=3)

    def create_booking(self, *, customer=None, starts_at=None):
        if customer:
            self.client.force_authenticate(customer)
        else:
            self.client.force_authenticate(None)
        return self.client.post(
            f"/api/v1/public/companies/{self.company.slug}/appointments/",
            booking_payload(self.service, self.professional, starts_at or self.starts_at),
            format="json",
        )

    def test_professional_key_is_hashed_single_use_and_scoped(self):
        self.client.force_authenticate(self.owner)
        issued = self.client.post(f"/api/v1/company/professionals/{self.professional.id}/access-key/")
        self.assertEqual(issued.status_code, status.HTTP_201_CREATED)
        secret = issued.data["access_key"]
        self.assertEqual(len(secret), 12)
        invite = ProfessionalAccessInvite.objects.get()
        self.assertNotEqual(invite.digest, secret)

        duplicate = self.client.post(f"/api/v1/company/professionals/{self.professional.id}/access-key/")
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ProfessionalAccessInvite.objects.count(), 1)

        self.client.force_authenticate(None)
        payload = {
            "full_name": "Professional Account",
            "email": "professional@example.com",
            "password": PASSWORD,
            "access_key": secret,
            "terms_accepted": True,
            "privacy_accepted": True,
        }
        created = self.client.post("/api/v1/professionals/register/", payload, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        reused = self.client.post(
            "/api/v1/professionals/register/",
            payload | {"email": "second-professional@example.com"},
            format="json",
        )
        self.assertEqual(reused.status_code, status.HTTP_400_BAD_REQUEST)
        self.professional.refresh_from_db()
        self.assertIsNotNone(self.professional.user_id)

        Appointment.objects.create(
            company=self.other_company, service=self.other_service, professional=self.other_professional,
            starts_at=self.other_start, ends_at=self.other_start + self.other_service.duration,
            customer_name="Other tenant", customer_email="other@example.com", customer_whatsapp="+5511999999999",
        )
        self.client.force_authenticate(self.professional.user)
        self.assertEqual(
            self.client.get(f"/api/v1/professional/appointments/{Appointment.objects.get(company=self.other_company).id}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        same_company_professional = self.professional.__class__.objects.create(company=self.company, name="Other professional")
        same_company_appointment = Appointment.objects.create(
            company=self.company, service=self.service, professional=same_company_professional,
            starts_at=self.starts_at + timedelta(hours=2), ends_at=self.starts_at + timedelta(hours=3),
            customer_name="Other agenda", customer_email="other-agenda@example.com", customer_whatsapp="+5511666666666",
        )
        self.assertEqual(
            self.client.get(f"/api/v1/professional/appointments/{same_company_appointment.id}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )

    def test_revoked_and_expired_keys_are_rejected(self):
        revoked, revoked_secret = ProfessionalAccessInvite.issue(professional=self.professional, created_by=self.owner)
        revoked.revoked_at = timezone.now()
        revoked.save(update_fields=("revoked_at", "updated_at"))
        expired, expired_secret = ProfessionalAccessInvite.issue(
            professional=self.professional, created_by=self.owner, ttl=timedelta(seconds=-1)
        )
        for index, secret in enumerate((revoked_secret, expired_secret)):
            response = self.client.post(
                "/api/v1/professionals/register/",
                {"full_name": "Rejected", "email": f"rejected-{index}@example.com", "password": PASSWORD,
                 "access_key": secret, "terms_accepted": True, "privacy_accepted": True},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_block_removes_slots_and_conflicts_require_confirmation(self):
        block_start = self.starts_at + timedelta(hours=1)
        block_end = block_start + timedelta(hours=1)
        self.client.force_authenticate(self.owner)
        created = self.client.post("/api/v1/company/unavailabilities/", {
            "professional": self.professional.id, "starts_at": block_start, "ends_at": block_end,
            "kind": "APPOINTMENT", "reason": "Compromisso",
        }, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        date = timezone.localtime(block_start).date().isoformat()
        self.client.force_authenticate(None)
        availability = self.client.get(
            f"/api/v1/public/companies/{self.company.slug}/availability/",
            {"service": self.service.id, "professional": self.professional.id, "date": date},
        )
        self.assertNotIn(block_start, {slot["starts_at"] for slot in availability.data})

        self.create_booking()
        self.client.force_authenticate(self.owner)
        conflict = self.client.post("/api/v1/company/unavailabilities/", {
            "professional": self.professional.id, "starts_at": self.starts_at,
            "ends_at": self.starts_at + timedelta(hours=1), "kind": "HOURS",
        }, format="json")
        self.assertEqual(conflict.status_code, status.HTTP_409_CONFLICT)
        forced = self.client.post("/api/v1/company/unavailabilities/", {
            "professional": self.professional.id, "starts_at": self.starts_at,
            "ends_at": self.starts_at + timedelta(hours=1), "kind": "HOURS", "allow_conflicts": True,
        }, format="json")
        self.assertEqual(forced.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ProfessionalUnavailability.objects.count(), 2)
        self.assertEqual(Appointment.objects.count(), 1)
        spanning = self.client.post("/api/v1/company/unavailabilities/", {
            "professional": self.professional.id,
            "starts_at": self.starts_at - timedelta(days=1),
            "ends_at": self.starts_at + timedelta(days=1),
            "kind": "VACATION",
            "allow_conflicts": True,
        }, format="json")
        self.assertEqual(spanning.status_code, status.HTTP_201_CREATED)
        self.client.force_authenticate(None)
        fully_blocked = self.client.get(
            f"/api/v1/public/companies/{self.company.slug}/availability/",
            {"service": self.service.id, "professional": self.professional.id, "date": date},
        )
        self.assertEqual(fully_blocked.data, [])

    def test_outcome_is_temporal_audited_and_tenant_scoped(self):
        past = timezone.now() - timedelta(hours=2)
        appointment = Appointment.objects.create(
            company=self.company, service=self.service, professional=self.professional,
            starts_at=past, ends_at=past + timedelta(minutes=30), status=Appointment.Status.CONFIRMED,
            customer_name="Past", customer_email="past@example.com", customer_whatsapp="+5511999999999",
        )
        self.client.force_authenticate(self.other_owner)
        self.assertEqual(
            self.client.post(f"/api/v1/company/appointments/{appointment.id}/outcome/", {"outcome": "NO_SHOW"}).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.client.force_authenticate(self.owner)
        completed = self.client.post(
            f"/api/v1/company/appointments/{appointment.id}/outcome/", {"outcome": "COMPLETED"}, format="json"
        )
        self.assertEqual(completed.status_code, status.HTTP_200_OK)
        self.assertEqual(AppointmentOutcomeEvent.objects.filter(appointment=appointment).count(), 1)
        customer = User.objects.create_user("outcome-customer@example.com", PASSWORD, full_name="Customer")
        self.client.force_authenticate(customer)
        self.assertEqual(
            self.client.post(f"/api/v1/company/appointments/{appointment.id}/outcome/", {"outcome": "NO_SHOW"}).status_code,
            status.HTTP_403_FORBIDDEN,
        )

        future = Appointment.objects.create(
            company=self.company, service=self.service, professional=self.professional,
            starts_at=self.starts_at + timedelta(hours=3), ends_at=self.starts_at + timedelta(hours=4),
            status=Appointment.Status.CONFIRMED, customer_name="Future", customer_email="future@example.com",
            customer_whatsapp="+5511999999999",
        )
        self.client.force_authenticate(self.owner)
        self.assertEqual(
            self.client.post(f"/api/v1/company/appointments/{future.id}/outcome/", {"outcome": "NO_SHOW"}).status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_verified_reviews_for_account_and_anonymous_token(self):
        customer = User.objects.create_user("reviewer@example.com", PASSWORD, full_name="Reviewer", whatsapp="+5511999999999")
        past = timezone.now() - timedelta(hours=2)
        account_booking = Appointment.objects.create(
            company=self.company, service=self.service, professional=self.professional, customer=customer,
            starts_at=past, ends_at=past + timedelta(minutes=30), status=Appointment.Status.CONFIRMED,
            outcome=Appointment.Outcome.COMPLETED, customer_name="Reviewer", customer_email=customer.email,
            customer_whatsapp=customer.whatsapp,
        )
        self.client.force_authenticate(customer)
        created = self.client.post(f"/api/v1/customers/appointments/{account_booking.id}/review/", {"rating": 5, "comment": "Ótimo"})
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.client.post(f"/api/v1/customers/appointments/{account_booking.id}/review/", {"rating": 4}).status_code, status.HTTP_400_BAD_REQUEST)

        anonymous = Appointment.objects.create(
            company=self.company, service=self.service, professional=self.professional,
            starts_at=past - timedelta(days=1), ends_at=past - timedelta(days=1) + timedelta(minutes=30),
            status=Appointment.Status.CONFIRMED, outcome=Appointment.Outcome.COMPLETED,
            customer_name="Anonymous", customer_email="anon@example.com", customer_whatsapp="+5511888888888",
        )
        _, secret = ReviewCredential.issue(anonymous, expires_at=timezone.now() + timedelta(days=1))
        self.client.force_authenticate(None)
        reviewed = self.client.post("/api/v1/public/reviews/", {"review_token": secret, "rating": 4}, format="json")
        self.assertEqual(reviewed.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.client.post("/api/v1/public/reviews/", {"review_token": secret, "rating": 4}).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Review.objects.count(), 2)
        no_show = Appointment.objects.create(
            company=self.company, service=self.service, professional=self.professional, customer=customer,
            starts_at=past - timedelta(days=2), ends_at=past - timedelta(days=2) + timedelta(minutes=30),
            status=Appointment.Status.CONFIRMED, outcome=Appointment.Outcome.NO_SHOW,
            customer_name="Reviewer", customer_email=customer.email, customer_whatsapp=customer.whatsapp,
        )
        self.client.force_authenticate(customer)
        self.assertEqual(
            self.client.post(f"/api/v1/customers/appointments/{no_show.id}/review/", {"rating": 5}).status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_anonymous_push_deduplicates_and_cannot_link_another_booking(self):
        first = self.create_booking()
        _, other_company = create_company("push-other")
        other_service, other_professional, other_start = create_booking_catalog(other_company)
        other = Appointment.objects.create(
            company=other_company, service=other_service, professional=other_professional,
            starts_at=other_start, ends_at=other_start + other_service.duration,
            customer_name="Other", customer_email="other-push@example.com", customer_whatsapp="+5511777777777",
        )
        payload = {
            "appointment": first.data["id"], "management_token": first.data["management_token"],
            "endpoint": "https://fcm.googleapis.com/subscription", "p256dh": "p" * 80, "auth": "a" * 24,
        }
        self.assertEqual(self.client.post("/api/v1/push/subscriptions/", payload, format="json").status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.client.post("/api/v1/push/subscriptions/", payload, format="json").status_code, status.HTTP_200_OK)
        self.assertEqual(PushSubscription.objects.count(), 1)
        self.assertEqual(BookingPushSubscription.objects.count(), 1)
        forbidden = self.client.post("/api/v1/push/subscriptions/", payload | {"appointment": other.id}, format="json")
        self.assertEqual(forbidden.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            self.client.post("/api/v1/push/subscriptions/", payload | {"auth": "short"}, format="json").status_code,
            status.HTTP_400_BAD_REQUEST,
        )
        customer = User.objects.create_user("push-customer@example.com", PASSWORD, full_name="Push Customer", whatsapp="+5511555555555")
        logged_booking = self.create_booking(customer=customer, starts_at=self.starts_at + timedelta(hours=1))
        authenticated = self.client.post("/api/v1/push/subscriptions/", {
            "appointment": logged_booking.data["id"],
            "endpoint": "https://fcm.googleapis.com/logged-subscription",
            "p256dh": "p" * 80,
            "auth": "a" * 24,
        }, format="json")
        self.assertEqual(authenticated.status_code, status.HTTP_201_CREATED)
        self.assertEqual(PushSubscription.objects.get(pk=authenticated.data["id"]).user_id, customer.id)

    def test_reports_are_tenant_scoped(self):
        Appointment.objects.create(
            company=self.company, service=self.service, professional=self.professional,
            starts_at=timezone.now(), ends_at=timezone.now() + timedelta(minutes=30), outcome=Appointment.Outcome.NO_SHOW,
            customer_name="A", customer_email="a@example.com", customer_whatsapp="+5511999999999",
        )
        Appointment.objects.create(
            company=self.other_company, service=self.other_service, professional=self.other_professional,
            starts_at=timezone.now(), ends_at=timezone.now() + timedelta(minutes=30), outcome=Appointment.Outcome.COMPLETED,
            customer_name="B", customer_email="b@example.com", customer_whatsapp="+5511888888888",
        )
        self.client.force_authenticate(self.owner)
        today = timezone.localdate().isoformat()
        report = self.client.get("/api/v1/company/reports/", {"date_from": today, "date_to": today})
        self.assertEqual(report.status_code, status.HTTP_200_OK)
        self.assertEqual(report.data["total"], 1)
        self.assertEqual(report.data["no_show"], 1)
        self.assertEqual(report.data["completed"], 0)

    def test_manual_booking_is_confirmed_scoped_and_rejects_overlap(self):
        self.client.force_authenticate(self.owner)
        url = "/api/v1/company/appointments/manual/"
        payload = booking_payload(self.service, self.professional, self.starts_at)
        created = self.client.post(url, payload, format="json")
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["status"], Appointment.Status.CONFIRMED)
        self.assertEqual(created.data["origin"], Appointment.Origin.ADMIN)
        self.assertEqual(self.client.post(url, payload, format="json").status_code, status.HTTP_409_CONFLICT)
        other = payload | {"service": str(self.other_service.id), "professional": str(self.other_professional.id)}
        self.assertEqual(self.client.post(url, other, format="json").status_code, status.HTTP_404_NOT_FOUND)
        self.client.force_authenticate(self.other_owner)
        self.assertEqual(self.client.get(f"/api/v1/company/appointments/{created.data['id']}/").status_code, status.HTTP_404_NOT_FOUND)

    def test_report_uses_account_identity_after_name_change(self):
        customer = User.objects.create_user("pedro@example.com", PASSWORD, full_name="Pedro", whatsapp="+5511999999999")
        for index, name in enumerate(("Pedro", "Pedro", "testeste")):
            if index == 2:
                customer.full_name = name
                customer.save(update_fields=("full_name",))
            start = self.starts_at + timedelta(hours=index)
            Appointment.objects.create(
                company=self.company, service=self.service, professional=self.professional,
                starts_at=start, ends_at=start + self.service.duration, customer=customer,
                customer_name=name, customer_email=customer.email, customer_whatsapp=customer.whatsapp,
            )
        self.client.force_authenticate(self.owner)
        day = timezone.localdate(self.starts_at).isoformat()
        report = self.client.get("/api/v1/company/reports/", {"date_from": day, "date_to": day})
        self.assertEqual(report.status_code, status.HTTP_200_OK)
        self.assertEqual(len(report.data["recurring_customers"]), 1)
        self.assertEqual(report.data["recurring_customers"][0]["customer_name"], "testeste")
        self.assertEqual(report.data["recurring_customers"][0]["total"], 3)

    def test_report_uses_normalized_contact_for_anonymous_customer(self):
        for index, name in enumerate(("Ana", "Ana Silva")):
            start = self.starts_at + timedelta(hours=index)
            Appointment.objects.create(
                company=self.company, service=self.service, professional=self.professional,
                starts_at=start, ends_at=start + self.service.duration,
                customer_name=name, customer_email="ANA@example.com" if index else "ana@example.com",
                customer_whatsapp="+5511999999999",
            )
        self.client.force_authenticate(self.owner)
        day = timezone.localdate(self.starts_at).isoformat()
        report = self.client.get("/api/v1/company/reports/", {"date_from": day, "date_to": day})
        self.assertEqual(len(report.data["recurring_customers"]), 1)
        self.assertEqual(report.data["recurring_customers"][0]["total"], 2)

    def test_tolerance_warns_without_changing_slot_spacing(self):
        self.service.slot_interval = timedelta(minutes=40)
        self.service.save(update_fields=("slot_interval", "updated_at"))
        settings = self.company.booking_settings
        settings.late_tolerance = timedelta(minutes=15)
        settings.save(update_fields=("late_tolerance", "updated_at"))
        self.client.force_authenticate(self.owner)
        response = self.client.get("/api/v1/company/settings/")
        self.assertIn("intervalo de 10 minutos", response.data["late_tolerance_warning"])

        date = timezone.localtime(self.starts_at).date().isoformat()
        self.client.force_authenticate(None)
        availability = self.client.get(
            f"/api/v1/public/companies/{self.company.slug}/availability/",
            {"service": self.service.id, "professional": self.professional.id, "date": date},
        )
        starts = [slot["starts_at"] for slot in availability.data]
        self.assertEqual(starts[1] - starts[0], timedelta(minutes=40))

    def test_permanently_gone_push_subscription_is_deactivated(self):
        booking = self.create_booking()
        appointment = Appointment.objects.get(pk=booking.data["id"])
        endpoint = "https://fcm.googleapis.com/gone"
        subscription = PushSubscription.objects.create(
            endpoint=endpoint,
            endpoint_digest=PushSubscription.digest_endpoint(endpoint),
            p256dh="p" * 80,
            auth="a" * 24,
            consented_at=timezone.now(),
        )
        BookingPushSubscription.objects.create(appointment=appointment, subscription=subscription)
        NotificationEvent.objects.create(
            appointment=appointment,
            kind=NotificationEvent.Kind.BOOKING_CANCELLED,
            scheduled_for=timezone.now() - timedelta(seconds=1),
        )
        gone = WebPushException("gone", response=SimpleNamespace(status_code=410))
        with patch("pywebpush.webpush", side_effect=gone):
            self.assertEqual(process_due_notifications(), 1)
        subscription.refresh_from_db()
        self.assertFalse(subscription.active)
        self.assertIsNotNone(subscription.revoked_at)


class ProfessionalInviteConcurrencyTests(TransactionTestCase):
    reset_sequences = False

    def test_access_key_cannot_be_consumed_concurrently(self):
        owner, company = create_company("invite-race")
        _, professional, _ = create_booking_catalog(company)
        _, secret = ProfessionalAccessInvite.issue(professional=professional, created_by=owner)

        def register(index):
            close_old_connections()
            client = APIClient()
            response = client.post("/api/v1/professionals/register/", {
                "full_name": f"Professional {index}",
                "email": f"professional-race-{index}@example.com",
                "password": PASSWORD,
                "access_key": secret,
                "terms_accepted": True,
                "privacy_accepted": True,
            }, format="json")
            close_old_connections()
            return response.status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(register, (1, 2)))
        self.assertCountEqual(results, (status.HTTP_201_CREATED, status.HTTP_400_BAD_REQUEST))
