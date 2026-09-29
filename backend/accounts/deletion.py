from django.db import transaction
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from bookings.models import Appointment, AppointmentManagementCredential, NotificationEvent, ReviewCredential
from platform_core.permissions import company_for_user
from professionals.models import Professional
from .models import User


@transaction.atomic
def delete_own_account(user, *, password, confirmation):
    user = User.objects.select_for_update(no_key=True).get(pk=user.pk)
    # ASVS 7.5.3/8.2.2: reauthenticate and operate exclusively on the authenticated subject.
    if confirmation != "EXCLUIR" or not user.check_password(password):
        raise ValidationError("Confirme EXCLUIR e informe sua senha atual corretamente.")
    if user.is_superuser or company_for_user(user):
        raise ValidationError("Contas proprietárias não podem ser excluídas enquanto responsáveis pela plataforma ou empresa. Contate o suporte para resolver a titularidade.")
    now = timezone.now()
    bookings = Appointment.objects.filter(customer=user)
    booking_ids = list(bookings.select_for_update().order_by("pk").values_list("pk", flat=True))
    bookings.filter(starts_at__gte=now, status__in=(Appointment.Status.WAITING_CONFIRMATION, Appointment.Status.CONFIRMED), outcome__isnull=True).update(
        status=Appointment.Status.CANCELLED, cancellation_reason="ACCOUNT_DELETED", updated_at=now,
    )
    bookings.update(customer=None, customer_name="Conta excluída", customer_email="", customer_whatsapp="", customer_notes="", updated_at=now)
    AppointmentManagementCredential.objects.filter(appointment_id__in=booking_ids).delete()
    ReviewCredential.objects.filter(appointment_id__in=booking_ids).delete()
    NotificationEvent.objects.filter(appointment_id__in=booking_ids, state=NotificationEvent.State.PENDING).delete()
    user.push_subscriptions.all().delete()
    user.reviews.update(customer=None, comment="")
    user.recorded_appointment_outcomes.update(outcome_recorded_by=None)
    Professional.objects.filter(user=user).update(user=None, access_active=False, updated_at=now)
    # ASVS 7.4.2: blacklist all refresh tokens; deleting the user also invalidates all access JWTs.
    for token in OutstandingToken.objects.filter(user=user).iterator():
        BlacklistedToken.objects.get_or_create(token=token)
    avatar_name = user.avatar.name if user.avatar else ""
    storage = user.avatar.storage if user.avatar else None
    try:
        user.delete()
    except ProtectedError as exc:
        raise ValidationError("Esta conta possui vínculos de titularidade protegidos. Contate o suporte.") from exc
    if avatar_name and storage:
        transaction.on_commit(lambda: storage.delete(avatar_name))
