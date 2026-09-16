from datetime import datetime, time, timedelta

from django.utils import timezone

from accounts.models import User
from companies.models import Company, CompanyBookingSettings
from professionals.models import Professional, WorkSchedule
from services.models import Service

PASSWORD = "Correct-Horse-Battery-Staple-123!"


def create_company(label, status=Company.Status.ACTIVE):
    owner = User.objects.create_user(
        email=f"owner-{label}@example.com",
        password=PASSWORD,
        full_name=f"Owner {label}",
        whatsapp="+5511999999999",
    )
    company = Company.objects.create(
        owner=owner,
        name=f"Company {label}",
        slug=f"company-{label}",
        whatsapp="+5511999999999",
        city="Jales",
        state="SP",
        niche="Health",
        business_type="Clinic",
        status=status,
    )
    CompanyBookingSettings.objects.create(company=company, minimum_change_notice=timedelta(hours=1))
    return owner, company


def create_booking_catalog(company, day_offset=2):
    service = Service.objects.create(company=company, name="Consultation", duration=timedelta(minutes=30))
    professional = Professional.objects.create(company=company, name="Professional")
    professional.services.add(service)
    target_date = timezone.localdate() + timedelta(days=day_offset)
    WorkSchedule.objects.create(
        professional=professional,
        weekday=target_date.weekday(),
        starts_at=time(9, 0),
        ends_at=time(17, 0),
    )
    starts_at = timezone.make_aware(datetime.combine(target_date, time(10, 0)))
    return service, professional, starts_at


def booking_payload(service, professional, starts_at, **overrides):
    payload = {
        "service": str(service.id),
        "professional": str(professional.id),
        "starts_at": starts_at.isoformat(),
        "customer_name": "Anonymous Customer",
        "customer_email": "anonymous@example.com",
        "customer_whatsapp": "+5511988887777",
        "customer_notes": "Please be punctual.",
    }
    payload.update(overrides)
    return payload
