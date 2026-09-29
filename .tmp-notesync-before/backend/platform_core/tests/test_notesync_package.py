from datetime import datetime, time, timedelta
from io import BytesIO, StringIO
from zoneinfo import ZoneInfo
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from threading import Event

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.db import connection, transaction, IntegrityError, close_old_connections
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from accounts.models import User
from bookings.expiration import expire_pending_appointments
from bookings.operations import BookingConflict, create_appointment, resolve_company_unit
from bookings.models import Appointment, AppointmentOutcomeEvent, NotificationEvent
from companies.models import Company, CompanyUnit
from customers.models import CompanyFavorite, FavoriteSuggestionDismissal
from professionals.models import ProfessionalAccessInvite, ProfessionalUnavailability, WorkSchedule
from .helpers import PASSWORD, booking_payload, create_booking_catalog, create_company


@override_settings(TURNSTILE_REQUIRED=False)
class NoteSyncPackageTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.company = create_company("package-a")
        self.other_owner, self.other_company = create_company("package-b")
        self.service, self.professional, self.start = create_booking_catalog(self.company)
        self.other_service, self.other_professional, self.other_start = create_booking_catalog(self.other_company)
        self.unit = self.company.units.get(is_primary=True)
        self.other_unit = self.other_company.units.get(is_primary=True)
        self.customer = User.objects.create_user(email="package-client@example.com", full_name="Cliente", password=PASSWORD, whatsapp="+5511999999999")
        self.second_customer = User.objects.create_user(email="package-second@example.com", full_name="Outro", password=PASSWORD)
        self.booking_url = f"/api/v1/public/companies/{self.company.slug}/appointments/"
        self.units_url = "/api/v1/company/units/"
        self.favorites_url = "/api/v1/customers/favorites/"
        self.delete_url = "/api/v1/auth/account/delete/"

    def appointment(self, *, company=None, customer=None, offset=0, status="CONFIRMED", outcome=None, start=None):
        company = company or self.company
        other = company == self.other_company
        service = self.other_service if other else self.service
        professional = self.other_professional if other else self.professional
        unit = self.other_unit if other else self.unit
        start = start or self.start + timedelta(hours=offset)
        return Appointment.objects.create(
            company=company, unit=unit, service=service, professional=professional,
            starts_at=start, ends_at=start + service.duration, customer=customer or self.customer,
            customer_name="Cliente", customer_email="package-client@example.com", customer_whatsapp="+5511999999999",
            status=status, outcome=outcome,
        )

    def branch(self):
        unit = CompanyUnit.objects.create(company=self.company, name="Filial", address="Rua Nova, 7", city="São Paulo", state="SP")
        self.professional.units.add(unit)
        return unit

    def test_company_single_unit_auto_selection_and_legacy_location_sync(self):
        self.assertEqual(self.professional.units.get(), self.unit)
        self.assertEqual(WorkSchedule.objects.get(professional=self.professional).unit, self.unit)
        self.company.address = "Endereço preservado"
        self.company.save(update_fields=("address",))
        self.unit.refresh_from_db()
        self.assertEqual(self.unit.address, "Endereço preservado")
        result = self.client.post(self.booking_url, booking_payload(self.service, self.professional, self.start), format="json")
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(str(result.data["unit"]), str(self.unit.pk))

    def test_unit_crud_primary_and_historical_delete(self):
        self.client.force_authenticate(self.owner)
        created = self.client.post(self.units_url, {"name": "Filial", "city": "Campinas", "state": "SP", "address": "Rua Filial", "is_primary": True}, format="json")
        self.assertEqual(created.status_code, 201, created.data)
        self.unit.refresh_from_db()
        self.company.refresh_from_db()
        self.assertFalse(self.unit.is_primary)
        self.assertEqual(self.company.address, "Rua Filial")
        self.assertEqual(self.company.units.filter(is_primary=True).count(), 1)
        self.assertEqual(self.client.patch(self.units_url + created.data["id"] + "/", {"is_active": False}, format="json").status_code, 400)
        self.assertEqual(self.client.delete(self.units_url + created.data["id"] + "/").status_code, 400)
        self.appointment()
        self.assertEqual(self.client.delete(self.units_url + str(self.unit.pk) + "/").status_code, 400)
        self.assertEqual(self.client.patch(self.units_url + str(self.unit.pk) + "/", {"is_active": False}, format="json").status_code, 200)
        empty = self.client.post(self.units_url, {"name": "Sem histórico"}, format="json")
        self.assertEqual(empty.status_code, 201)
        self.assertEqual(self.client.delete(self.units_url + empty.data["id"] + "/").status_code, 204)

    def test_unit_permissions_and_tenant_scope(self):
        self.assertEqual(self.client.get(self.units_url).status_code, 401)
        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.post(self.units_url, {"name": "Ataque"}).status_code, 403)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get(self.units_url + str(self.other_unit.pk) + "/").status_code, 404)
        self.assertEqual(self.client.patch(self.units_url + str(self.other_unit.pk) + "/", {"name": "Ataque"}).status_code, 404)
        self.assertEqual(self.client.delete(self.units_url + str(self.other_unit.pk) + "/").status_code, 404)
        rows = self.client.get(self.units_url).data
        self.assertEqual([row["id"] for row in rows], [str(self.unit.pk)])

    def test_unit_database_invariants(self):
        for values in ({"is_primary": True}, {"name": self.unit.name}):
            with self.assertRaises(IntegrityError), transaction.atomic():
                CompanyUnit.objects.create(company=self.company, name=values.get("name", "Nova"), is_primary=values.get("is_primary", False))

    def test_multi_unit_booking_availability_schedule_and_service(self):
        branch = self.branch()
        self.assertEqual(self.client.post(self.booking_url, booking_payload(self.service, self.professional, self.start), format="json").status_code, 400)
        params = {"service": str(self.service.pk), "professional": str(self.professional.pk), "date": timezone.localdate(self.start).isoformat(), "unit": str(branch.pk)}
        availability_url = f"/api/v1/public/companies/{self.company.slug}/availability/"
        self.assertEqual(self.client.get(availability_url, params).data, [])
        self.client.force_authenticate(self.owner)
        schedule_url = "/api/v1/company/work-schedules/"
        overlap = {"professional": str(self.professional.pk), "unit": str(branch.pk), "weekday": timezone.localdate(self.start).weekday(), "starts_at": "09:00", "ends_at": "17:00"}
        self.assertEqual(self.client.post(schedule_url, overlap, format="json").status_code, 400)
        overlap.update(starts_at="18:00", ends_at="20:00")
        self.assertEqual(self.client.post(schedule_url, overlap, format="json").status_code, 201)
        self.client.force_authenticate(None)
        slots = self.client.get(availability_url, params)
        self.assertEqual(slots.status_code, 200, slots.data)
        self.assertTrue(slots.data)
        start = slots.data[0]["starts_at"]
        result = self.client.post(self.booking_url, booking_payload(self.service, self.professional, start, unit=str(branch.pk)), format="json")
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(result.data["unit"], branch.pk)
        self.assertNotIn(start, {slot["starts_at"] for slot in self.client.get(availability_url, params).data})
        self.service.units.add(self.unit)
        rejected = self.client.post(self.booking_url, booking_payload(self.service, self.professional, start + timedelta(hours=1), unit=str(branch.pk)), format="json")
        self.assertEqual(rejected.status_code, 400)

    def test_foreign_unit_rejected_at_every_input_boundary(self):
        payload = booking_payload(self.service, self.professional, self.start, unit=str(self.other_unit.pk))
        self.assertEqual(self.client.post(self.booking_url, payload, format="json").status_code, 404)
        params = {"service": str(self.service.pk), "date": timezone.localdate(self.start).isoformat(), "unit": str(self.other_unit.pk)}
        self.assertEqual(self.client.get(f"/api/v1/public/companies/{self.company.slug}/availability/", params).status_code, 404)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post("/api/v1/company/appointments/manual/", payload, format="json").status_code, 404)
        self.assertEqual(self.client.patch(f"/api/v1/company/professionals/{self.professional.pk}/", {"unit_ids": [str(self.other_unit.pk)]}, format="json").status_code, 400)
        self.assertEqual(self.client.patch(f"/api/v1/company/services/{self.service.pk}/", {"unit_ids": [str(self.other_unit.pk)]}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/v1/company/work-schedules/", {"professional": str(self.professional.pk), "unit": str(self.other_unit.pk), "weekday": 1, "starts_at": "07:00", "ends_at": "08:00"}, format="json").status_code, 400)

    def test_professional_requires_unit_membership_and_cannot_remove_scheduled_unit(self):
        branch = CompanyUnit.objects.create(company=self.company, name="Outra")
        self.client.force_authenticate(self.owner)
        response = self.client.post("/api/v1/company/work-schedules/", {"professional": str(self.professional.pk), "unit": str(branch.pk), "weekday": 1, "starts_at": "07:00", "ends_at": "08:00"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.patch(f"/api/v1/company/professionals/{self.professional.pk}/", {"unit_ids": []}, format="json").status_code, 400)

    def test_search_location_is_same_active_unit_and_public_page_lists_units(self):
        branch = self.branch()
        response = self.client.get("/api/v1/public/companies/", {"city": "Sao Paulo", "state": "SP"})
        self.assertEqual([row["id"] for row in response.data["results"]], [str(self.company.pk)])
        self.assertEqual(len(self.client.get(f"/api/v1/public/companies/{self.company.slug}/").data["units"]), 2)
        branch.is_active = False
        branch.save()
        self.assertEqual(self.client.get("/api/v1/public/companies/", {"city": "Sao Paulo"}).data["count"], 0)
        branch.is_active = True
        branch.state = "RJ"
        branch.save()
        self.assertEqual(self.client.get("/api/v1/public/companies/", {"city": "Sao Paulo", "state": "SP"}).data["count"], 0)

    def test_month_availability_is_bounded_and_matches_real_slots(self):
        day = timezone.localdate(self.start)
        params = {"service": str(self.service.pk), "professional": str(self.professional.pk), "start_date": day.isoformat(), "end_date": day.isoformat()}
        endpoint = f"/api/v1/public/companies/{self.company.slug}/availability/days/"
        response = self.client.get(endpoint, params)
        self.assertEqual(response.data, {"available_dates": [day.isoformat()]})
        self.assertEqual(self.client.get(endpoint, {**params, "end_date": (day + timedelta(days=31)).isoformat()}).status_code, 400)

    def test_expired_confirmation_is_rejected_even_with_a_worker_backlog(self):
        for offset in (4, 3, 2):
            self.appointment(start=timezone.now()-timedelta(days=offset), status="WAITING_CONFIRMATION")
        target = self.appointment(start=timezone.now()-timedelta(days=1), status="WAITING_CONFIRMATION")
        self.client.force_authenticate(self.owner)
        def bounded_expiration(**kwargs):
            return expire_pending_appointments(**{**kwargs, "limit": 1})
        with patch("bookings.views.expire_pending_appointments", side_effect=bounded_expiration):
            result = self.client.post(f"/api/v1/company/appointments/{target.pk}/confirm/")
        self.assertEqual(result.status_code, 400)
        target.refresh_from_db()
        self.assertEqual(target.status, "CANCELLED")
        self.assertEqual(target.cancellation_reason, "EXPIRED_UNCONFIRMED")

    def test_professional_units_and_manual_booking_are_tenant_scoped(self):
        self.professional.user = self.customer
        self.professional.save()
        self.client.force_authenticate(self.customer)
        response = self.client.get("/api/v1/professional/appointments/units/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [str(self.unit.pk)])
        payload = booking_payload(self.service, self.professional, self.start, unit=str(self.other_unit.pk))
        endpoint = "/api/v1/professional/appointments/manual/"
        self.assertEqual(self.client.post(endpoint, payload, format="json").status_code, 404)
        payload["unit"] = str(self.unit.pk)
        result = self.client.post(endpoint, payload, format="json")
        self.assertEqual(result.status_code, 201, result.data)
        self.assertEqual(str(result.data["unit"]), str(self.unit.pk))
        self.assertEqual(result.data["status"], "CONFIRMED")

    def test_calendar_is_private_bounded_timezone_correct_and_paginated(self):
        # 01:30 UTC belongs to the prior day in Sao Paulo.
        instant = timezone.now().replace(hour=1, minute=30, second=0, microsecond=0) + timedelta(days=3)
        first = self.appointment(start=instant)
        self.appointment(offset=8, customer=self.second_customer)
        self.client.force_authenticate(self.customer)
        local_day = timezone.localdate(instant)
        url = "/api/v1/customers/appointments/"
        result = self.client.get(url, {"start_date": local_day.isoformat(), "end_date": local_day.isoformat()})
        self.assertEqual([row["id"] for row in result.data["results"]], [str(first.pk)])
        self.assertEqual(result.data["results"][0]["unit_name"], self.unit.name)
        for params in ({"start_date": "bad", "end_date": local_day.isoformat()}, {"start_date": local_day.isoformat()}, {"start_date": local_day.isoformat(), "end_date": (local_day+timedelta(days=63)).isoformat()}):
            self.assertEqual(self.client.get(url, params).status_code, 400)
        self.client.force_authenticate(self.second_customer)
        self.assertEqual(self.client.get(url + str(first.pk) + "/").status_code, 404)
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, 401)

    def test_favorites_add_duplicate_list_remove_and_customer_isolation(self):
        self.assertEqual(self.client.get(self.favorites_url).status_code, 401)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post(self.favorites_url, {"company": str(self.company.pk)}).status_code, 403)
        self.client.force_authenticate(self.customer)
        first = self.client.post(self.favorites_url, {"company": str(self.company.pk)}, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        duplicate = self.client.post(self.favorites_url, {"company": str(self.company.pk)}, format="json")
        self.assertEqual(duplicate.status_code, 200)
        self.assertEqual(CompanyFavorite.objects.count(), 1)
        self.assertEqual(self.client.get(self.favorites_url).data["count"], 1)
        self.client.force_authenticate(self.second_customer)
        self.assertEqual(self.client.get(self.favorites_url).data["count"], 0)
        self.assertEqual(self.client.delete(self.favorites_url + first.data["id"] + "/").status_code, 404)
        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.delete(self.favorites_url + first.data["id"] + "/").status_code, 204)
        self.assertFalse(CompanyFavorite.objects.exists())

    def test_suggestion_counts_three_confirmed_not_cancelled_waiting_or_no_show(self):
        self.client.force_authenticate(self.customer)
        endpoint = self.favorites_url + "suggestions/"
        for offset, state, outcome in ((0, "CANCELLED", None), (1, "WAITING_CONFIRMATION", None), (2, "CONFIRMED", "NO_SHOW"), (3, "CONFIRMED", "COMPLETED"), (4, "CONFIRMED", None)):
            self.appointment(offset=offset, status=state, outcome=outcome)
        self.appointment(offset=5, customer=self.second_customer)
        self.assertEqual(self.client.get(endpoint).data, [])
        self.appointment(offset=6)
        self.assertEqual([row["id"] for row in self.client.get(endpoint).data], [str(self.company.pk)])
        self.client.post(self.favorites_url, {"company": str(self.company.pk)}, format="json")
        self.assertEqual(self.client.get(endpoint).data, [])

    def test_suggestion_dismissal_persists_across_clients_and_can_favorite_manually(self):
        for offset in range(3):
            self.appointment(offset=offset)
        self.client.force_authenticate(self.customer)
        self.assertTrue(self.client.get(self.favorites_url + "suggestions/").data)
        self.assertEqual(self.client.post(self.favorites_url + "dismiss-suggestion/", {"company": str(self.company.pk)}, format="json").status_code, 204)
        second_device = APIClient()
        second_device.force_authenticate(self.customer)
        self.assertEqual(second_device.get(self.favorites_url + "suggestions/").data, [])
        self.assertEqual(FavoriteSuggestionDismissal.objects.count(), 1)
        self.assertEqual(second_device.post(self.favorites_url, {"company": str(self.company.pk)}, format="json").status_code, 201)

    def test_expiration_only_waiting_without_outcome_across_tenants_and_timezone(self):
        now = timezone.now()
        past = now - timedelta(days=2)
        cases = [
            ("WAITING_CONFIRMATION", None, past, "CANCELLED"),
            ("WAITING_CONFIRMATION", None, now + timedelta(days=2), "WAITING_CONFIRMATION"),
            ("CONFIRMED", None, past+timedelta(hours=1), "CONFIRMED"),
            ("CONFIRMED", "COMPLETED", past+timedelta(hours=2), "CONFIRMED"),
            ("CONFIRMED", "NO_SHOW", past+timedelta(hours=3), "CONFIRMED"),
            ("CANCELLED", None, past+timedelta(hours=4), "CANCELLED"),
        ]
        rows = [(self.appointment(status=state, outcome=outcome, start=start), expected) for state, outcome, start, expected in cases]
        other = self.appointment(company=self.other_company, status="WAITING_CONFIRMATION", start=now-timedelta(hours=1))
        with timezone.override(ZoneInfo("Asia/Tokyo")):
            self.assertEqual(expire_pending_appointments(now=now), 2)
            self.assertEqual(expire_pending_appointments(now=now), 0)
        for row, expected in rows:
            row.refresh_from_db()
            self.assertEqual(row.status, expected)
        other.refresh_from_db()
        self.assertEqual(other.cancellation_reason, "EXPIRED_UNCONFIRMED")
        self.assertEqual(NotificationEvent.objects.filter(kind="BOOKING_CANCELLED").count(), 2)

    def test_scheduled_worker_expires_without_any_browser_and_read_refreshes_status(self):
        row = self.appointment(status="WAITING_CONFIRMATION", start=timezone.now()-timedelta(hours=1))
        call_command("process_notifications", limit=1, stdout=StringIO())
        row.refresh_from_db()
        self.assertEqual(row.status, "CANCELLED")
        another = self.appointment(status="WAITING_CONFIRMATION", start=timezone.now()-timedelta(hours=3))
        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.get(f"/api/v1/customers/appointments/{another.pk}/").data["status"], "CANCELLED")
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post(f"/api/v1/company/appointments/{another.pk}/confirm/").status_code, 400)

    def test_delete_own_account_anonymizes_history_preserves_other_clients_and_revokes_tokens(self):
        row = self.appointment()
        other = self.appointment(offset=1, customer=self.second_customer)
        token = RefreshToken.for_user(self.customer)
        access = str(token.access_token)
        self.client.force_authenticate(self.customer)
        result = self.client.post(self.delete_url, {"password": PASSWORD, "confirmation": "EXCLUIR"}, format="json")
        self.assertEqual(result.status_code, 204, result.data)
        self.assertEqual(result.cookies["obn_refresh"]["max-age"], 0)
        self.assertFalse(User.objects.filter(pk=self.customer.pk).exists())
        row.refresh_from_db(); other.refresh_from_db()
        self.assertIsNone(row.customer)
        self.assertEqual((row.customer_email, row.customer_whatsapp, row.status), ("", "", "CANCELLED"))
        self.assertEqual(other.customer, self.second_customer)
        client = APIClient()
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(client.get("/api/v1/auth/me/").status_code, 401)
        with self.assertRaises(TokenError):
            RefreshToken(str(token))
        self.assertTrue(Company.objects.filter(pk=self.company.pk).exists())

    def test_delete_requires_password_confirmation_auth_and_cannot_target_another(self):
        self.assertEqual(self.client.post(self.delete_url, {}).status_code, 401)
        self.client.force_authenticate(self.customer)
        for payload in ({"password": "wrong", "confirmation": "EXCLUIR"}, {"password": PASSWORD, "confirmation": ""}, {"password": PASSWORD, "confirmation": "EXCLUIR", "user_id": str(self.second_customer.pk)}):
            self.assertEqual(self.client.post(self.delete_url, payload, format="json").status_code, 400)
            self.assertTrue(User.objects.filter(pk=self.customer.pk).exists())
        self.assertTrue(User.objects.filter(pk=self.second_customer.pk).exists())

    def test_owner_deletion_refused_without_losing_company_data(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post(self.delete_url, {"password": PASSWORD, "confirmation": "EXCLUIR"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertTrue(User.objects.filter(pk=self.owner.pk).exists())
        self.assertTrue(self.company.units.exists())

    def test_professional_account_deletion_keeps_professional_and_outcome_audit(self):
        self.professional.user = self.customer
        self.professional.save()
        row = self.appointment(start=timezone.now()-timedelta(days=1), outcome="COMPLETED")
        row.outcome_recorded_by = self.customer
        row.save()
        event = AppointmentOutcomeEvent.objects.create(appointment=row, actor=self.customer, outcome="COMPLETED")
        absence = ProfessionalUnavailability.objects.create(company=self.company, professional=self.professional, starts_at=self.start, ends_at=self.start+timedelta(hours=1), created_by=self.customer)
        invite, _ = ProfessionalAccessInvite.issue(professional=self.professional, created_by=self.customer)
        self.client.force_authenticate(self.customer)
        self.assertEqual(self.client.post(self.delete_url, {"password": PASSWORD, "confirmation": "EXCLUIR"}, format="json").status_code, 204)
        self.professional.refresh_from_db(); event.refresh_from_db(); row.refresh_from_db()
        self.assertIsNone(self.professional.user)
        self.assertFalse(self.professional.access_active)
        self.assertIsNone(event.actor)
        self.assertEqual(row.outcome, "COMPLETED")
        absence.refresh_from_db(); invite.refresh_from_db()
        self.assertIsNone(absence.created_by)
        self.assertIsNone(invite.created_by)

    def test_deletion_enforces_csrf_even_with_bearer_token(self):
        client = APIClient(enforce_csrf_checks=True)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(self.customer).access_token}")
        data = {"password": PASSWORD, "confirmation": "EXCLUIR"}
        self.assertEqual(client.post(self.delete_url, data, format="json").status_code, 403)
        client.get("/api/v1/auth/csrf/")
        self.assertEqual(client.post(self.delete_url, data, format="json", HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value).status_code, 204)

    @override_settings(STORAGES={"default": {"BACKEND": "django.core.files.storage.InMemoryStorage"}})
    def test_avatar_upload_content_size_authorization_normalization_and_cleanup(self):
        url = "/api/v1/customers/profile/me/"
        self.assertEqual(self.client.patch(url, {}).status_code, 401)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.patch(url, {}).status_code, 403)
        self.client.force_authenticate(self.customer)
        for content, mime in ((b"<svg></svg>", "image/png"), (b"invalid", "image/jpeg"), (b"x"*(2*1024*1024+1), "image/png")):
            result = self.client.patch(url, {"avatar": SimpleUploadedFile("avatar.png", content, content_type=mime)}, format="multipart")
            self.assertEqual(result.status_code, 400)
        image = BytesIO(); Image.new("RGB", (1000, 800), color="navy").save(image, format="PNG")
        mismatch = self.client.patch(url, {"avatar": SimpleUploadedFile("photo.png", image.getvalue(), content_type="image/jpeg")}, format="multipart")
        self.assertEqual(mismatch.status_code, 400)
        with self.captureOnCommitCallbacks(execute=True):
            result = self.client.patch(url, {"avatar": SimpleUploadedFile("../../photo.php", image.getvalue()+b"<?php unsafe ?>", content_type="image/png")}, format="multipart")
        self.assertEqual(result.status_code, 200, result.data)
        self.customer.refresh_from_db()
        name, storage = self.customer.avatar.name, self.customer.avatar.storage
        with storage.open(name) as file:
            data = file.read()
            self.assertNotIn(b"unsafe", data)
            with Image.open(BytesIO(data)) as normalized:
                self.assertLessEqual(max(normalized.size), 512)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.post(self.delete_url, {"password": PASSWORD, "confirmation": "EXCLUIR"}, format="json").status_code, 204)
        self.assertFalse(storage.exists(name))

    def test_list_serializers_do_not_add_queries_per_appointment(self):
        self.client.force_authenticate(self.customer)
        self.appointment()
        with CaptureQueriesContext(connection) as first:
            self.client.get("/api/v1/customers/appointments/")
        for offset in range(1, 6):
            self.appointment(offset=offset)
        with CaptureQueriesContext(connection) as many:
            self.client.get("/api/v1/customers/appointments/")
        self.assertLessEqual(len(many), len(first)+1)


class UnitMigrationTests(TransactionTestCase):
    def test_booking_and_unavailability_do_not_deadlock_on_company_foreign_key(self):
        owner, company = create_company('concurrent-package')
        service, professional, start = create_booking_catalog(company)
        catalog_locked = Event()

        def resolve_after_lock(*args, **kwargs):
            catalog_locked.set()
            return resolve_company_unit(*args, **kwargs)

        def reserve():
            close_old_connections()
            try:
                with patch('bookings.operations.resolve_company_unit', side_effect=resolve_after_lock):
                    create_appointment(company=company, service_id=service.pk, professional_id=professional.pk, starts_at=start, customer=None, customer_data={'customer_name': 'Cliente', 'customer_email': 'concurrent@example.com', 'customer_whatsapp': '+5511999999999'})
            except BookingConflict:
                return 'blocked'
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=1) as pool:
            with transaction.atomic():
                type(professional).objects.select_for_update().get(pk=professional.pk)
                future = pool.submit(reserve)
                self.assertTrue(catalog_locked.wait(10), 'Booking did not reach company lock')
                ProfessionalUnavailability.objects.create(company=company, professional=professional, starts_at=start, ends_at=start+service.duration, created_by=owner)
            self.assertEqual(future.result(timeout=10), 'blocked')
        self.assertFalse(Appointment.objects.filter(company=company).exists())

    def test_legacy_address_and_bookings_backfilled_and_reverse_preserves_data(self):
        executor = MigrationExecutor(connection)
        latest = executor.loader.graph.leaf_nodes()
        old = [("accounts", "0003_user_auth_version_accountactionauthorization_and_more"), ("companies", "0007_companybookingsettings_whatsapp_messages"), ("professionals", "0003_professional_access_active_professional_user_and_more"), ("bookings", "0002_appointment_origin_appointment_outcome_and_more"), ("services", "0003_service_slot_interval"), ("customers", None)]
        try:
            executor.migrate(old)
            apps = executor.loader.project_state([target for target in old if target[1]]).apps
            user = apps.get_model("accounts", "User").objects.create(email="legacy@example.com", full_name="Legado", password="hash")
            company = apps.get_model("companies", "Company").objects.create(owner_id=user.pk, name="Legado", slug="legado", address="Rua Original, 42", city="Jales", state="SP", whatsapp="+5511999999999", niche="Health", business_type="Clinic")
            professional = apps.get_model("professionals", "Professional").objects.create(company_id=company.pk, name="Profissional")
            schedule = apps.get_model("professionals", "WorkSchedule").objects.create(professional_id=professional.pk, weekday=1, starts_at=time(9), ends_at=time(17))
            service = apps.get_model("services", "Service").objects.create(company_id=company.pk, name="Serviço", duration=timedelta(minutes=30))
            start = timezone.now() + timedelta(days=5)
            appointment = apps.get_model("bookings", "Appointment").objects.create(company_id=company.pk, professional_id=professional.pk, service_id=service.pk, starts_at=start, ends_at=start+timedelta(minutes=30), customer_name="Legado", customer_email="legacy@example.com", customer_whatsapp="+5511999999999")
            executor = MigrationExecutor(connection); executor.migrate(latest)
            unit = CompanyUnit.objects.get(company_id=company.pk, is_primary=True)
            self.assertEqual((unit.address, unit.city, unit.state), ("Rua Original, 42", "Jales", "SP"))
            self.assertEqual(Appointment.objects.get(pk=appointment.pk).unit_id, unit.pk)
            self.assertEqual(WorkSchedule.objects.get(pk=schedule.pk).unit_id, unit.pk)
            self.assertTrue(unit.professionals.filter(pk=professional.pk).exists())
            executor = MigrationExecutor(connection); executor.migrate(old)
            apps = executor.loader.project_state([target for target in old if target[1]]).apps
            self.assertEqual(apps.get_model("companies", "Company").objects.get(pk=company.pk).address, "Rua Original, 42")
            self.assertEqual(apps.get_model("bookings", "Appointment").objects.get(pk=appointment.pk).starts_at, start)
        finally:
            MigrationExecutor(connection).migrate(latest)
