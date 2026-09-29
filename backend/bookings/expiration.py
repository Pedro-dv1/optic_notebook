from django.db import transaction
from django.utils import timezone

from .models import Appointment, NotificationEvent


def expire_pending_appointments(*, company=None, customer=None, professional=None, appointment=None, limit=500, now=None):
    """Bounded, idempotent worker; locks also coordinate with confirmation."""
    now = now or timezone.now()
    queryset = Appointment.objects.filter(
        status=Appointment.Status.WAITING_CONFIRMATION, outcome__isnull=True, starts_at__lte=now,
    )
    for field, value in (("company", company), ("customer", customer), ("professional", professional), ("pk", appointment.pk if appointment else None)):
        if value is not None:
            queryset = queryset.filter(**{field: value})
    with transaction.atomic():
        ids = list(queryset.select_for_update(skip_locked=True).order_by("starts_at").values_list("pk", flat=True)[:limit])
        if not ids:
            return 0
        Appointment.objects.filter(pk__in=ids).update(
            status=Appointment.Status.CANCELLED, cancellation_reason="EXPIRED_UNCONFIRMED", updated_at=now,
        )
        NotificationEvent.objects.filter(
            appointment_id__in=ids, state=NotificationEvent.State.PENDING,
        ).exclude(kind=NotificationEvent.Kind.BOOKING_CANCELLED).delete()
        NotificationEvent.objects.bulk_create([
            NotificationEvent(appointment_id=pk, kind=NotificationEvent.Kind.BOOKING_CANCELLED, scheduled_for=now)
            for pk in ids
        ], ignore_conflicts=True)
    return len(ids)
