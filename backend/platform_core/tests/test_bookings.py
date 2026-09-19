from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from django.core.cache import cache
from django.db import close_old_connections
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework import serializers
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from bookings.models import Appointment, AppointmentManagementCredential
from bookings.operations import create_appointment
from companies.models import Company

from .helpers import PASSWORD, booking_payload, create_booking_catalog, create_company


class PublicBookingTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.company = create_company("booking")
        self.service, self.professional, self.starts_at = create_booking_catalog(self.company)
        self.url = f"/api/v1/public/companies/{self.company.slug}/appointments/"

    def test_anonymous_customer_can_book_and_receives_one_time_management_token(self):
        response = self.client.post(
            self.url,
            booking_payload(self.service, self.professional, self.starts_at),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], Appointment.Status.WAITING_CONFIRMATION)
        self.assertIn("management_token", response.data)
        appointment = Appointment.objects.get()
        credential = AppointmentManagementCredential.objects.get(appointment=appointment)
        self.assertNotEqual(credential.digest, response.data["management_token"])
        self.assertIsNone(appointment.customer)

    def test_authenticated_customer_uses_saved_data(self):
        customer = User.objects.create_user(
            "saved@example.com", PASSWORD, full_name="Saved Name", whatsapp="+5511944444444"
        )
        self.client.force_authenticate(customer)
        payload = booking_payload(self.service, self.professional, self.starts_at)
        for key in ("customer_name", "customer_email", "customer_whatsapp"):
            payload.pop(key)
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        appointment = Appointment.objects.get()
        self.assertEqual(appointment.customer, customer)
        self.assertEqual(appointment.customer_name, customer.full_name)
        self.assertEqual(appointment.customer_email, customer.email)
        self.assertEqual(appointment.customer_whatsapp, customer.whatsapp)

    def test_authenticated_customer_can_override_snapshot_without_changing_profile(self):
        customer = User.objects.create_user(
            "profile@example.com", PASSWORD, full_name="Profile Name", whatsapp="+5511955555555"
        )
        self.client.force_authenticate(customer)
        payload = booking_payload(
            self.service,
            self.professional,
            self.starts_at,
            customer_name="Booking Name",
            customer_email="booking-only@example.com",
            customer_whatsapp="+5511966666666",
        )
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        appointment = Appointment.objects.get()
        self.assertEqual(appointment.customer_name, "Booking Name")
        self.assertEqual(appointment.customer_email, "booking-only@example.com")
        customer.refresh_from_db()
        self.assertEqual(customer.full_name, "Profile Name")
        self.assertEqual(customer.email, "profile@example.com")
        self.assertEqual(customer.whatsapp, "+5511955555555")

    def test_occupied_time_is_rejected(self):
        payload = booking_payload(self.service, self.professional, self.starts_at)
        self.assertEqual(self.client.post(self.url, payload, format="json").status_code, status.HTTP_201_CREATED)
        second = self.client.post(self.url, payload | {"customer_email": "other@example.com"}, format="json")
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(Appointment.objects.count(), 1)

    def test_other_company_does_not_contaminate_availability(self):
        _, other_company = create_company("other-availability")
        other_service, other_professional, other_start = create_booking_catalog(other_company)
        Appointment.objects.create(
            company=other_company,
            service=other_service,
            professional=other_professional,
            starts_at=other_start,
            ends_at=other_start + other_service.duration,
            customer_name="Other",
            customer_email="other@example.com",
            customer_whatsapp="+5511912345678",
        )
        date = timezone.localtime(self.starts_at).date().isoformat()
        availability = self.client.get(
            f"/api/v1/public/companies/{self.company.slug}/availability/",
            {"service": self.service.id, "date": date},
        )
        self.assertEqual(availability.status_code, status.HTTP_200_OK)
        returned_starts = {item["starts_at"] for item in availability.data}
        self.assertIn(self.starts_at, returned_starts)

    def test_availability_and_creation_use_service_interval_not_legacy_company_interval(self):
        self.company.booking_settings.slot_interval = timedelta(minutes=30)
        self.company.booking_settings.save(update_fields=("slot_interval", "updated_at"))
        self.service.slot_interval = timedelta(minutes=10)
        self.service.save(update_fields=("slot_interval", "updated_at"))
        start = self.starts_at + timedelta(minutes=10)
        date = timezone.localtime(start).date().isoformat()
        availability = self.client.get(
            f"/api/v1/public/companies/{self.company.slug}/availability/",
            {"service": self.service.id, "date": date},
        )
        self.assertEqual(availability.status_code, status.HTTP_200_OK)
        self.assertIn(start, {item["starts_at"] for item in availability.data})
        created = self.client.post(
            self.url,
            booking_payload(self.service, self.professional, start),
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)

    def test_whatsapp_message_uses_tenant_template_and_safe_placeholders(self):
        self.company.booking_settings.whatsapp_confirmed_message = (
            "Oi {cliente}: {servico} com {profissional} em {data} às {hora} — {empresa}. {desconhecido}"
        )
        self.company.booking_settings.save(update_fields=("whatsapp_confirmed_message", "updated_at"))
        created = self.client.post(
            self.url,
            booking_payload(self.service, self.professional, self.starts_at),
            format="json",
        )
        self.client.force_authenticate(self.owner)
        confirmed = self.client.post(f"/api/v1/company/appointments/{created.data['id']}/confirm/")
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        self.assertIn("Anonymous Customer", confirmed.data["whatsapp_message"])
        self.assertIn(self.company.name, confirmed.data["whatsapp_message"])
        self.assertIn("{desconhecido}", confirmed.data["whatsapp_message"])

    def test_management_token_cancels_and_invalid_token_does_not(self):
        created = self.client.post(
            self.url,
            booking_payload(self.service, self.professional, self.starts_at),
            format="json",
        )
        endpoint = f"/api/v1/public/companies/{self.company.slug}/appointments/cancel/"
        invalid = self.client.post(endpoint, {"management_token": "obn_appt_" + "x" * 43}, format="json")
        self.assertEqual(invalid.status_code, status.HTTP_404_NOT_FOUND)
        appointment = Appointment.objects.get()
        self.assertEqual(appointment.status, Appointment.Status.WAITING_CONFIRMATION)
        cancelled = self.client.post(endpoint, {"management_token": created.data["management_token"]}, format="json")
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, Appointment.Status.CANCELLED)

    def test_management_token_reschedules_and_revalidates_availability(self):
        created = self.client.post(
            self.url,
            booking_payload(self.service, self.professional, self.starts_at),
            format="json",
        )
        endpoint = f"/api/v1/public/companies/{self.company.slug}/appointments/reschedule/"
        new_start = self.starts_at + timedelta(hours=1)
        response = self.client.post(
            endpoint,
            {"management_token": created.data["management_token"], "starts_at": new_start.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        appointment = Appointment.objects.get()
        self.assertEqual(appointment.starts_at, new_start)

    def test_reschedule_to_occupied_time_is_rejected_without_state_change(self):
        first = self.client.post(
            self.url,
            booking_payload(self.service, self.professional, self.starts_at),
            format="json",
        )
        occupied_start = self.starts_at + timedelta(hours=1)
        second = self.client.post(
            self.url,
            booking_payload(
                self.service,
                self.professional,
                occupied_start,
                customer_email="second@example.com",
            ),
            format="json",
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        response = self.client.post(
            f"/api/v1/public/companies/{self.company.slug}/appointments/reschedule/",
            {"management_token": first.data["management_token"], "starts_at": occupied_start.isoformat()},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        original = Appointment.objects.get(pk=first.data["id"])
        self.assertEqual(original.starts_at, self.starts_at)

    def test_management_token_is_scoped_to_company(self):
        created = self.client.post(
            self.url,
            booking_payload(self.service, self.professional, self.starts_at),
            format="json",
        )
        _, other_company = create_company("management-other")
        response = self.client.post(
            f"/api/v1/public/companies/{other_company.slug}/appointments/cancel/",
            {"management_token": created.data["management_token"]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        appointment = Appointment.objects.get(company=self.company)
        self.assertEqual(appointment.status, Appointment.Status.WAITING_CONFIRMATION)

    def test_cancellation_and_reschedule_respect_notice_period(self):
        self.company.booking_settings.minimum_change_notice = timedelta(days=10)
        self.company.booking_settings.save()
        created = self.client.post(
            self.url,
            booking_payload(self.service, self.professional, self.starts_at),
            format="json",
        )
        token = created.data["management_token"]
        cancel = self.client.post(
            f"/api/v1/public/companies/{self.company.slug}/appointments/cancel/",
            {"management_token": token},
            format="json",
        )
        self.assertEqual(cancel.status_code, status.HTTP_400_BAD_REQUEST)
        reschedule = self.client.post(
            f"/api/v1/public/companies/{self.company.slug}/appointments/reschedule/",
            {"management_token": token, "starts_at": (self.starts_at + timedelta(hours=1)).isoformat()},
            format="json",
        )
        self.assertEqual(reschedule.status_code, status.HTTP_400_BAD_REQUEST)
        appointment = Appointment.objects.get()
        self.assertEqual(appointment.starts_at, self.starts_at)
        self.assertEqual(appointment.status, Appointment.Status.WAITING_CONFIRMATION)

    def test_company_admin_can_confirm_own_appointment(self):
        self.client.post(self.url, booking_payload(self.service, self.professional, self.starts_at), format="json")
        appointment = Appointment.objects.get()
        self.client.force_authenticate(self.owner)
        response = self.client.post(f"/api/v1/company/appointments/{appointment.id}/confirm/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        appointment.refresh_from_db()
        self.assertEqual(appointment.status, Appointment.Status.CONFIRMED)

    def test_customer_profile_update_does_not_bypass_email_verification(self):
        customer = User.objects.create_user(
            "explicit@example.com", PASSWORD, full_name="Before", whatsapp="+5511977777777"
        )
        self.client.force_authenticate(customer)
        response = self.client.patch(
            "/api/v1/customers/profile/me/",
            {"full_name": "After", "email": "after@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        customer.refresh_from_db()
        self.assertEqual(customer.full_name, "After")
        self.assertEqual(customer.email, "explicit@example.com")

    def test_authenticated_customer_can_cancel_own_booking(self):
        customer = User.objects.create_user(
            "owner-customer@example.com", PASSWORD, full_name="Booking Owner", whatsapp="+5511977777777"
        )
        self.client.force_authenticate(customer)
        payload = booking_payload(self.service, self.professional, self.starts_at)
        created = self.client.post(self.url, payload, format="json")
        response = self.client.post(f"/api/v1/customers/appointments/{created.data['id']}/cancel/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], Appointment.Status.CANCELLED)


class DoubleBookingConcurrencyTests(TransactionTestCase):
    def test_concurrent_requests_cannot_double_book(self):
        _, company = create_company("double-book")
        service, professional, starts_at = create_booking_catalog(company)
        customer_data = {
            "customer_name": "Concurrent",
            "customer_email": "concurrent@example.com",
            "customer_whatsapp": "+5511987654321",
            "customer_notes": "",
        }

        def book():
            close_old_connections()
            try:
                create_appointment(
                    company=Company.objects.select_related("booking_settings").get(pk=company.pk),
                    service_id=service.pk,
                    professional_id=professional.pk,
                    starts_at=starts_at,
                    customer=None,
                    customer_data=customer_data,
                )
                result = "created"
            except serializers.ValidationError as exc:
                result = exc.__class__.__name__
            close_old_connections()
            return result

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _: book(), range(2)))

        self.assertEqual(results.count("created"), 1)
        self.assertEqual(Appointment.objects.count(), 1)
