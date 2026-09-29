from django.db import migrations


def backfill(apps, schema_editor):
    Company = apps.get_model("companies", "Company")
    Unit = apps.get_model("companies", "CompanyUnit")
    Professional = apps.get_model("professionals", "Professional")
    Schedule = apps.get_model("professionals", "WorkSchedule")
    Appointment = apps.get_model("bookings", "Appointment")
    database = schema_editor.connection.alias
    memberships = Professional.units.through
    for company in Company.objects.using(database).iterator(chunk_size=500):
        unit, _ = Unit.objects.using(database).get_or_create(
            company_id=company.pk, is_primary=True,
            defaults={"name": "Principal", "address": company.address, "city": company.city, "state": company.state},
        )
        professionals = Professional.objects.using(database).filter(company_id=company.pk)
        memberships.objects.using(database).bulk_create([
            memberships(professional_id=pk, companyunit_id=unit.pk)
            for pk in professionals.values_list("pk", flat=True)
        ], ignore_conflicts=True)
        Schedule.objects.using(database).filter(professional__company_id=company.pk, unit__isnull=True).update(unit_id=unit.pk)
        Appointment.objects.using(database).filter(company_id=company.pk, unit__isnull=True).update(unit_id=unit.pk)


class Migration(migrations.Migration):
    dependencies = [
        ("companies", "0008_companyunit"),
        ("professionals", "0004_professional_units_workschedule_unit"),
        ("bookings", "0003_appointment_cancellation_reason_appointment_unit_and_more"),
    ]
    # Reverse keeps the legacy address columns intact; prior migrations remove the additive fields/tables.
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
