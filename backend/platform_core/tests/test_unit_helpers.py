from datetime import datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from django.test import SimpleTestCase

from bookings.messaging import appointment_whatsapp_message
from bookings.models import Appointment
from platform_core.search import normalize_search, normalized_contains


class SearchNormalizationUnitTests(SimpleTestCase):
    def test_normalizes_case_and_accents(self):
        self.assertEqual(normalize_search("Clínica SÃO José"), "clinica sao jose")
        self.assertTrue(normalized_contains("pao", "Pão artesanal"))


class AppointmentMessageUnitTests(SimpleTestCase):
    def test_replaces_known_placeholders_and_preserves_unknown_ones(self):
        settings = SimpleNamespace(
            whatsapp_waiting_message="",
            whatsapp_confirmed_message="Olá {cliente}, {servico} às {hora}. {invalido}",
            whatsapp_cancelled_message="",
        )
        appointment = SimpleNamespace(
            status=Appointment.Status.CONFIRMED,
            starts_at=datetime(2030, 1, 10, 14, 30, tzinfo=ZoneInfo("America/Sao_Paulo")),
            customer_name="José",
            company=SimpleNamespace(name="Clínica São José", booking_settings=settings),
            service=SimpleNamespace(name="Avaliação"),
            professional=SimpleNamespace(name="Ana"),
        )
        self.assertEqual(
            appointment_whatsapp_message(appointment),
            "Olá José, Avaliação às 14:30. {invalido}",
        )
