import json
import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import NotificationEvent, ReviewCredential

logger = logging.getLogger("optic_notebook.security")


def _payload(event, review_token=None):
    local_start = timezone.localtime(event.appointment.starts_at)
    messages = {
        NotificationEvent.Kind.BOOKING_CONFIRMED: ("Agendamento confirmado", "Seu atendimento foi confirmado."),
        NotificationEvent.Kind.BOOKING_REMINDER: (
            "Lembrete de atendimento",
            f"Você possui um atendimento em {local_start:%d/%m} às {local_start:%H:%M}.",
        ),
        NotificationEvent.Kind.BOOKING_RESCHEDULED: (
            "Agendamento alterado",
            f"Seu atendimento foi reagendado para {local_start:%d/%m} às {local_start:%H:%M}.",
        ),
        NotificationEvent.Kind.BOOKING_CANCELLED: ("Agendamento cancelado", "Um de seus agendamentos foi cancelado."),
        NotificationEvent.Kind.REVIEW_REQUEST: ("Como foi seu atendimento?", "Conte como foi sua experiência."),
    }
    title, body = messages[event.kind]
    if event.kind == NotificationEvent.Kind.REVIEW_REQUEST:
        url = f"/avaliar#token={review_token}" if review_token else f"/cliente#avaliar={event.appointment_id}"
    else:
        url = "/cliente" if event.appointment.customer_id else f"/cliente/agendar/{event.appointment.company.slug}"
    return json.dumps({"title": title, "body": body, "url": url}, ensure_ascii=False)


def _send(event):
    if event.appointment.customer_id and event.appointment.customer.notification_preference is False:
        return 0
    from pywebpush import WebPushException, webpush

    links = list(event.appointment.push_links.select_related("subscription").filter(subscription__active=True))
    if not links:
        return 0
    review_token = None
    if event.kind == NotificationEvent.Kind.REVIEW_REQUEST and event.appointment.customer_id is None:
        _, review_token = ReviewCredential.issue(
            event.appointment,
            expires_at=timezone.now() + timedelta(days=30),
        )
    payload = _payload(event, review_token)
    sent = 0
    for link in links:
        subscription = link.subscription
        try:
            webpush(
                subscription_info={
                    "endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                },
                data=payload,
                vapid_private_key=settings.WEB_PUSH_VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.WEB_PUSH_VAPID_SUBJECT},
                timeout=settings.WEB_PUSH_TIMEOUT_SECONDS,
                ttl=86_400,
            )
            sent += 1
        except WebPushException as exc:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
            if status_code in (404, 410):
                subscription.active = False
                subscription.revoked_at = timezone.now()
                subscription.save(update_fields=("active", "revoked_at", "updated_at"))
                continue
            raise
    return sent


def process_due_notifications(limit=100):
    processed = 0
    # ponytail: a five-minute lease is enough for this cron worker; add a queue when measured throughput requires it.
    while processed < limit:
        with transaction.atomic():
            event = NotificationEvent.objects.select_for_update(
                skip_locked=True, of=("self", "appointment", "appointment__company"),
            ).select_related(
                "appointment__company", "appointment__customer"
            ).filter(state=NotificationEvent.State.PENDING, scheduled_for__lte=timezone.now()).order_by("scheduled_for").first()
            if not event:
                break
            event.attempts += 1
            event.scheduled_for = timezone.now() + timedelta(minutes=5)
            event.save(update_fields=("attempts", "scheduled_for", "updated_at"))
        try:
            _send(event)
        except Exception as exc:
            if event.attempts >= 3:
                NotificationEvent.objects.filter(pk=event.pk, state=NotificationEvent.State.PENDING).update(
                    state=NotificationEvent.State.FAILED,
                )
            logger.warning("push_delivery_failed event_id=%s error_type=%s", event.id, type(exc).__name__)
        else:
            NotificationEvent.objects.filter(pk=event.pk, state=NotificationEvent.State.PENDING).update(
                state=NotificationEvent.State.SENT,
                processed_at=timezone.now(),
            )
        processed += 1
    return processed
