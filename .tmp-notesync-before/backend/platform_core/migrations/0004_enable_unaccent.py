from django.contrib.postgres.operations import UnaccentExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("platform_core", "0003_legalacceptance")]

    operations = [UnaccentExtension()]
