from django.core.management.base import BaseCommand
from bookings.expiration import expire_pending_appointments


class Command(BaseCommand):
    help = "Cancela solicitações vencidas que não foram confirmadas (idempotente)."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=500)

    def handle(self, *args, **options):
        count = expire_pending_appointments(limit=max(1, min(options["limit"], 5000)))
        self.stdout.write(f"expired={count}")
