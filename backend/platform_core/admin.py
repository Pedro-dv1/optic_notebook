from django.contrib import admin

from .models import RegistrationKey


@admin.register(RegistrationKey)
class RegistrationKeyAdmin(admin.ModelAdmin):
    list_display = ("id", "state", "created_by", "created_at", "consumed_at")
    exclude = ("digest",)
    readonly_fields = ("created_by", "created_at", "updated_at", "consumed_at", "consumed_by_company")

    def has_add_permission(self, request):
        return False
