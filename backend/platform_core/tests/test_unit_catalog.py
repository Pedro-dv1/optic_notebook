from datetime import time, timedelta
from importlib import import_module

from django.apps import apps
from django.core.cache import cache
from django.db import connection
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User
from bookings.models import Appointment
from companies.models import CompanyUnit
from customers.models import CompanyFavorite
from professionals.models import Professional, WorkSchedule
from services.models import Service
from .helpers import PASSWORD, booking_payload, create_booking_catalog, create_company


@override_settings(TURNSTILE_REQUIRED=False)
class UnitCatalogTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.company = create_company("catalog-a")
        self.service, self.professional, self.start = create_booking_catalog(self.company)
        self.unit = self.company.units.get(is_primary=True)
        self.branch = CompanyUnit.objects.create(company=self.company, name="Shopping", city="Campinas", state="SP")
        self.branch_service = Service.objects.create(company=self.company, name="Premium", duration=timedelta(minutes=30))
        self.branch_service.units.add(self.branch)
        self.branch_professional = Professional.objects.create(company=self.company, name="Lucas")
        self.branch_professional.units.add(self.branch)
        self.branch_professional.services.add(self.branch_service)
        WorkSchedule.objects.create(professional=self.branch_professional, unit=self.branch,
                                    weekday=timezone.localdate(self.start).weekday(), starts_at=time(9), ends_at=time(17))
        self.other_owner, self.other_company = create_company("catalog-b")
        self.other_service, self.other_professional, _ = create_booking_catalog(self.other_company)
        self.other_unit = self.other_company.units.get(is_primary=True)
        self.public = f"/api/v1/public/companies/{self.company.slug}/"

    def test_unit_catalogs_are_independent_and_tenant_scoped(self):
        for unit, service, professional in ((self.unit, self.service, self.professional),
                                             (self.branch, self.branch_service, self.branch_professional)):
            services = self.client.get(self.public + "services/", {"unit": unit.pk})
            self.assertEqual(services.status_code, 200)
            self.assertEqual([row["id"] for row in services.data], [str(service.pk)])
            people = self.client.get(self.public + "professionals/", {"unit": unit.pk})
            self.assertEqual([row["id"] for row in people.data], [str(professional.pk)])
            self.assertEqual(people.data[0]["service_ids"], [service.pk])
        for path in ("services/", "professionals/"):
            self.assertEqual(self.client.get(self.public + path, {"unit": self.other_unit.pk}).status_code, 404)
        self.assertEqual(self.client.get(self.public + "professionals/", {"unit": self.unit.pk, "service": self.branch_service.pk}).status_code, 404)

    def test_unassigned_resources_do_not_become_global_or_copy_to_new_units(self):
        unassigned = Service.objects.create(company=self.company, name="Unassigned", duration=timedelta(minutes=30))
        person = Professional.objects.create(company=self.company, name="Unassigned")
        self.assertFalse(unassigned.units.exists())
        self.assertFalse(person.units.exists())
        for unit in (self.unit, self.branch):
            rows = self.client.get(self.public + "services/", {"unit": unit.pk}).data
            self.assertNotIn(str(unassigned.pk), [row["id"] for row in rows])
        self.assertEqual(self.client.get(self.public + "availability/", {"service": unassigned.pk,
                         "unit": self.branch.pk, "date": timezone.localdate(self.start)}).status_code, 400)

    def test_availability_and_booking_reject_sibling_and_foreign_resources(self):
        for service, professional, unit, expected in (
            (self.branch_service, self.branch_professional, self.unit, 400),
            (self.service, self.professional, self.branch, 400),
            (self.other_service, self.other_professional, self.unit, 404),
        ):
            payload = booking_payload(service, professional, self.start, unit=str(unit.pk))
            self.assertEqual(self.client.post(self.public + "appointments/", payload, format="json").status_code, expected)
            self.client.force_authenticate(self.owner)
            self.assertEqual(self.client.post("/api/v1/company/appointments/manual/", payload, format="json").status_code, expected)
            self.client.force_authenticate(None)
        response = self.client.post(self.public + "appointments/", booking_payload(
            self.branch_service, self.branch_professional, self.start, unit=str(self.branch.pk)), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["unit"], self.branch.pk)

    def test_admin_memberships_are_required_compatible_and_filtered(self):
        self.client.force_authenticate(self.owner)
        services_url, people_url = "/api/v1/company/services/", "/api/v1/company/professionals/"
        self.assertEqual(self.client.post(services_url, {"name": "Missing", "duration": "00:30:00"}, format="json").status_code, 400)
        self.assertEqual(self.client.post(people_url, {"name": "Missing"}, format="json").status_code, 400)
        for url, resource, foreign, related_field in ((services_url, self.service, self.other_unit, "professional_ids"),
                                                    (people_url, self.professional, self.other_unit, "service_ids")):
            for ids in ([], [str(foreign.pk)]):
                self.assertEqual(self.client.patch(url + str(resource.pk) + "/", {"unit_ids": ids}, format="json").status_code, 400)
            rows = self.client.get(url, {"unit": self.branch.pk}).data["results"]
            self.assertNotIn(str(resource.pk), [row["id"] for row in rows])
            self.assertEqual(self.client.get(url, {"unit": foreign.pk}).status_code, 404)
            sibling = self.branch_professional if related_field == "professional_ids" else self.branch_service
            self.assertEqual(self.client.patch(url + str(resource.pk) + "/", {related_field: [str(sibling.pk)]}, format="json").status_code, 400)
        # Equal labels can be configured independently in different units.
        payload = {"name": self.service.name, "duration": "00:30:00", "unit_ids": [str(self.branch.pk)]}
        self.assertEqual(self.client.post(services_url, payload, format="json").status_code, 201)
        self.assertEqual(self.client.post(services_url, payload, format="json").status_code, 400)

    def test_future_bookings_prevent_service_unit_removal(self):
        self.service.units.add(self.branch)
        self.professional.units.add(self.branch)
        Appointment.objects.create(company=self.company, unit=self.branch, service=self.service,
            professional=self.professional, starts_at=self.start, ends_at=self.start+self.service.duration,
            customer_name="Customer", customer_email="customer@example.com", customer_whatsapp="+5511999999999")
        self.client.force_authenticate(self.owner)
        response = self.client.patch(f"/api/v1/company/services/{self.service.pk}/", {"unit_ids": [str(self.unit.pk)]}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertTrue(self.service.units.filter(pk=self.branch.pk).exists())

    def test_discovery_service_and_location_must_belong_to_same_unit(self):
        url = "/api/v1/public/companies/"
        rejected = self.client.get(url, {"city": self.unit.city, "service": "Premium"})
        self.assertEqual(rejected.status_code, 200, rejected.data)
        self.assertEqual(rejected.data["count"], 0)
        accepted = self.client.get(url, {"city": self.branch.city, "service": "Premium"})
        self.assertEqual(accepted.data["count"], 1)
        self.branch.is_active = False
        self.branch.save()
        self.assertEqual(self.client.get(url, {"search": "Premium"}).data["count"], 0)

    def test_discovery_does_not_combine_city_and_state_of_different_memberships(self):
        self.branch.state = "RJ"
        self.branch.save()
        self.service.units.add(self.branch)
        response = self.client.get("/api/v1/public/companies/", {
            "service": self.service.name, "city": self.branch.city, "state": self.unit.state,
        })
        self.assertEqual(response.data["count"], 0)

    def test_favorites_prioritize_on_server_before_pagination_and_do_not_limit_search(self):
        customer = User.objects.create_user("recommend@example.com", PASSWORD, full_name="Customer")
        other_customer = User.objects.create_user("recommend-other@example.com", PASSWORD, full_name="Other")
        CompanyFavorite.objects.create(customer=customer, company=self.other_company)
        CompanyFavorite.objects.create(customer=other_customer, company=self.company)
        url = "/api/v1/public/companies/"
        # Exercise real JWT authentication, not only force_authenticate.
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(customer)}")
        result = self.client.get(url, {"page_size": 1})
        self.assertEqual(result.status_code, 200, result.data)
        self.assertEqual(result.data["count"], 2)
        self.assertEqual(result.data["results"][0]["id"], str(self.other_company.pk))
        alphabetical = self.client.get(url, {"ordering": "name"})
        self.assertEqual(alphabetical.data["results"][0]["id"], str(self.company.pk))
        self.client.credentials()
        self.assertEqual(self.client.get(url).data["results"][0]["id"], str(self.company.pk))
        self.client.force_authenticate(other_customer)
        self.assertEqual(self.client.get(url).data["results"][0]["id"], str(self.company.pk))

    def test_legacy_backfill_preserves_memberships_and_historical_bookings(self):
        self.service.units.clear()
        linked_service = Service.objects.create(company=self.company, name="Legacy linked", duration=timedelta(minutes=30))
        self.branch_professional.services.add(linked_service)
        Appointment.objects.create(company=self.company, unit=self.branch, service=self.service,
            professional=self.professional, starts_at=self.start, ends_at=self.start+self.service.duration,
            customer_name="Legacy", customer_email="legacy@example.com", customer_whatsapp="+5511999999999")
        migration = import_module("services.migrations.0005_remove_service_unique_service_name_per_company")
        with connection.schema_editor() as editor:
            migration.scope_legacy_services(apps, editor)
        self.assertEqual(set(self.service.units.values_list("pk", flat=True)), {self.unit.pk, self.branch.pk})
        self.assertEqual(set(linked_service.units.values_list("pk", flat=True)), {self.unit.pk, self.branch.pk})
        self.assertEqual(set(self.branch_service.units.values_list("pk", flat=True)), {self.branch.pk})
