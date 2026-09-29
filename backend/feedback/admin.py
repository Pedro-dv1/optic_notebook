from django.contrib import admin

from .models import Feedback, FeedbackAttachment, FeedbackReply


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ("public_id", "title", "user", "category", "status", "priority", "created_at")
    list_filter = ("category", "status", "priority", "user_type")
    search_fields = ("title", "description", "user__email", "user__full_name")
    readonly_fields = ("public_id", "created_at", "updated_at")


admin.site.register(FeedbackAttachment)
admin.site.register(FeedbackReply)
