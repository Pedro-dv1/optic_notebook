from django.core.management.base import BaseCommand

from bookings.notifications import process_due_notifications
from bookings.expiration import expire_pending_appointments


class Command(BaseCommand):
    help = "Envia eventos de notificação pendentes de forma idempotente."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        expired = expire_pending_appointments()
        processed = process_due_notifications(limit=max(1, min(options["limit"], 1000)))
        self.stdout.write(f"expired={expired} processed={processed}")
