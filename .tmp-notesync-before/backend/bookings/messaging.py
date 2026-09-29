import re

from django.utils import timezone

from .models import Appointment

PLACEHOLDER_PATTERN = re.compile(r"\{(cliente|empresa|servico|profissional|data|hora)\}")

DEFAULT_MESSAGES = {
    Appointment.Status.WAITING_CONFIRMATION: (
        "Olá, {cliente}! Recebemos seu pedido de agendamento para {servico}, "
        "no dia {data} às {hora}, na {empresa}. A confirmação será enviada em breve."
    ),
    Appointment.Status.CONFIRMED: (
        "Olá, {cliente}! Seu agendamento para {servico}, no dia {data} às {hora}, "
        "na {empresa}, foi confirmado."
    ),
    Appointment.Status.CANCELLED: (
        "Olá, {cliente}. Seu agendamento para {servico}, no dia {data} às {hora}, "
        "na {empresa}, foi cancelado."
    ),
}

SETTING_BY_STATUS = {
    Appointment.Status.WAITING_CONFIRMATION: "whatsapp_waiting_message",
    Appointment.Status.CONFIRMED: "whatsapp_confirmed_message",
    Appointment.Status.CANCELLED: "whatsapp_cancelled_message",
}


def appointment_whatsapp_message(appointment):
    company_settings = appointment.company.booking_settings
    template = getattr(company_settings, SETTING_BY_STATUS.get(appointment.status, ""), "").strip()
    template = template or DEFAULT_MESSAGES.get(
        appointment.status,
        DEFAULT_MESSAGES[Appointment.Status.WAITING_CONFIRMATION],
    )
    starts_at = timezone.localtime(appointment.starts_at)
    values = {
        "cliente": appointment.customer_name,
        "empresa": appointment.company.name,
        "servico": appointment.service.name,
        "profissional": appointment.professional.name,
        "data": starts_at.strftime("%d/%m/%Y"),
        "hora": starts_at.strftime("%H:%M"),
    }
    return PLACEHOLDER_PATTERN.sub(lambda match: values[match.group(1)], template)
