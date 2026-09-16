from datetime import timedelta

from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from bookings.models import Appointment
from companies.models import Company
from professionals.models import Professional, WorkSchedule
from services.models import Service

from .helpers import PASSWORD, booking_payload, create_booking_catalog, create_company


class TenantIsolationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner_a, self.company_a = create_company("a")
        self.owner_b, self.company_b = create_company("b")
        self.service_a, self.professional_a, self.start_a = create_booking_catalog(self.company_a)
        self.service_b, self.professional_b, self.start_b = create_booking_catalog(self.company_b)
        self.schedule_b = WorkSchedule.objects.get(professional=self.professional_b)
        self.appointment_b = Appointment.objects.create(
            company=self.company_b,
            service=self.service_b,
            professional=self.professional_b,
            starts_at=self.start_b,
            ends_at=self.start_b + self.service_b.duration,
            customer_name="B customer",
            customer_email="b-customer@example.com",
            customer_whatsapp="+5511911111111",
        )
        self.client.force_authenticate(self.owner_a)

    def test_company_a_cannot_read_or_modify_company_b_service(self):
        detail = f"/api/v1/company/services/{self.service_b.id}/"
        self.assertEqual(self.client.get(detail).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.patch(detail, {"name": "Stolen"}, format="json").status_code, status.HTTP_404_NOT_FOUND)
        self.service_b.refresh_from_db()
        self.assertEqual(self.service_b.name, "Consultation")

    def test_company_a_cannot_access_company_b_professional_or_schedule(self):
        professional_url = f"/api/v1/company/professionals/{self.professional_b.id}/"
        schedule_url = f"/api/v1/company/work-schedules/{self.schedule_b.id}/"
        self.assertEqual(self.client.get(professional_url).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.patch(schedule_url, {"starts_at": "08:00"}, format="json").status_code, status.HTTP_404_NOT_FOUND)
        self.schedule_b.refresh_from_db()
        self.assertEqual(str(self.schedule_b.starts_at), "09:00:00")

    def test_company_a_cannot_discover_or_confirm_company_b_appointment(self):
        detail = f"/api/v1/company/appointments/{self.appointment_b.id}/"
        self.assertEqual(self.client.get(detail).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.post(f"{detail}confirm/").status_code, status.HTTP_404_NOT_FOUND)
        self.appointment_b.refresh_from_db()
        self.assertEqual(self.appointment_b.status, Appointment.Status.WAITING_CONFIRMATION)

    def test_mass_assignment_cannot_change_tenant_or_privileged_fields(self):
        response = self.client.post(
            "/api/v1/company/services/",
            {
                "name": "Injected",
                "duration": "00:30:00",
                "company": str(self.company_b.id),
                "owner": str(self.owner_b.id),
                "status": "SUSPENDED",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Service.objects.get(name="Injected")
        self.assertEqual(created.company, self.company_a)
        self.company_a.refresh_from_db()
        self.assertEqual(self.company_a.status, Company.Status.ACTIVE)

    def test_work_schedule_rejects_invalid_and_overlapping_ranges(self):
        invalid = self.client.post(
            "/api/v1/company/work-schedules/",
            {
                "professional": str(self.professional_a.id),
                "weekday": self.start_a.weekday(),
                "starts_at": "12:00:00",
                "ends_at": "11:00:00",
            },
            format="json",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        overlapping = self.client.post(
            "/api/v1/company/work-schedules/",
            {
                "professional": str(self.professional_a.id),
                "weekday": self.start_a.weekday(),
                "starts_at": "10:00:00",
                "ends_at": "12:00:00",
            },
            format="json",
        )
        self.assertEqual(overlapping.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(WorkSchedule.objects.filter(professional=self.professional_a).count(), 1)

    def test_week_schedule_creates_all_days_or_none(self):
        professional = Professional.objects.create(company=self.company_a, name="Weekly")
        response = self.client.post(
            "/api/v1/company/work-schedules/week/",
            {"professional": str(professional.id), "starts_at": "09:00", "ends_at": "17:00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(set(WorkSchedule.objects.filter(professional=professional).values_list("weekday", flat=True)), set(range(7)))

        conflicting = self.client.post(
            "/api/v1/company/work-schedules/week/",
            {"professional": str(self.professional_a.id), "starts_at": "08:00", "ends_at": "10:00"},
            format="json",
        )
        self.assertEqual(conflicting.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(WorkSchedule.objects.filter(professional=self.professional_a).count(), 1)


class CustomerIsolationTests(APITestCase):
    def setUp(self):
        cache.clear()
        _, self.company = create_company("customer-isolation")
        service, professional, starts_at = create_booking_catalog(self.company)
        self.customer_a = User.objects.create_user("customer-a@example.com", PASSWORD, full_name="A", whatsapp="+5511922222222")
        self.customer_b = User.objects.create_user("customer-b@example.com", PASSWORD, full_name="B", whatsapp="+5511933333333")
        self.booking_b = Appointment.objects.create(
            company=self.company,
            service=service,
            professional=professional,
            starts_at=starts_at,
            ends_at=starts_at + service.duration,
            customer=self.customer_b,
            customer_name="B",
            customer_email=self.customer_b.email,
            customer_whatsapp=self.customer_b.whatsapp,
        )
        self.client.force_authenticate(self.customer_a)

    def test_customer_a_cannot_read_cancel_or_reschedule_customer_b_booking(self):
        detail = f"/api/v1/customers/appointments/{self.booking_b.id}/"
        self.assertEqual(self.client.get(detail).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.post(f"{detail}cancel/").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(
            self.client.post(f"{detail}reschedule/", {"starts_at": (self.booking_b.starts_at + timedelta(hours=1)).isoformat()}, format="json").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.booking_b.refresh_from_db()
        self.assertEqual(self.booking_b.status, Appointment.Status.WAITING_CONFIRMATION)


class SuspensionTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.company = create_company("suspended", status=Company.Status.SUSPENDED)
        self.service, self.professional, self.starts_at = create_booking_catalog(self.company)

    def test_suspended_company_is_not_publicly_operable(self):
        detail = self.client.get(f"/api/v1/public/companies/{self.company.slug}/")
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["status"], Company.Status.SUSPENDED)
        self.assertEqual(self.client.get(f"/api/v1/public/companies/{self.company.slug}/services/").status_code, status.HTTP_404_NOT_FOUND)
        response = self.client.post(
            f"/api/v1/public/companies/{self.company.slug}/appointments/",
            booking_payload(self.service, self.professional, self.starts_at),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(Appointment.objects.exists())

    def test_suspended_admin_can_read_status_but_cannot_perform_crud(self):
        self.client.force_authenticate(self.owner)
        profile = self.client.get("/api/v1/company/profile/")
        self.assertEqual(profile.status_code, status.HTTP_200_OK)
        self.assertEqual(profile.data["status"], Company.Status.SUSPENDED)
        self.assertEqual(
            self.client.patch("/api/v1/company/profile/", {"name": "Changed"}, format="json").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(self.client.get("/api/v1/company/services/").status_code, status.HTTP_403_FORBIDDEN)
        self.company.refresh_from_db()
        self.assertEqual(self.company.name, "Company suspended")
        self.assertTrue(Service.objects.filter(pk=self.service.pk).exists())

    def test_suspended_admin_can_login_to_read_suspension_status(self):
        response = self.client.post(
            "/api/v1/auth/login/", {"email": self.owner.email, "password": PASSWORD}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["company"]["status"], Company.Status.SUSPENDED)

    def test_only_superuser_reactivation_restores_access(self):
        self.client.force_authenticate(self.owner)
        endpoint = f"/api/v1/platform/companies/{self.company.id}/reactivate/"
        self.assertEqual(self.client.post(endpoint).status_code, status.HTTP_403_FORBIDDEN)
        superuser = User.objects.create_superuser("suspension-root@example.com", PASSWORD, full_name="Root")
        self.client.force_authenticate(superuser)
        self.assertEqual(self.client.post(endpoint).status_code, status.HTTP_200_OK)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.get("/api/v1/company/services/").status_code, status.HTTP_200_OK)
