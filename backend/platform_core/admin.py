from django.contrib import admin

from .models import LegalAcceptance, RegistrationKey


@admin.register(RegistrationKey)
class RegistrationKeyAdmin(admin.ModelAdmin):
    list_display = ("id", "state", "created_by", "created_at", "consumed_at")
    exclude = ("digest",)
    readonly_fields = ("created_by", "created_at", "updated_at", "consumed_at", "consumed_by_company")

    def has_add_permission(self, request):
        return False


@admin.register(LegalAcceptance)
class LegalAcceptanceAdmin(admin.ModelAdmin):
    list_display = ("document_type", "document_version", "context", "user", "company", "appointment", "accepted_at")
    list_filter = ("document_type", "document_version", "context")
    readonly_fields = tuple(field.name for field in LegalAcceptance._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
