from pathlib import Path

from rest_framework import serializers

from platform_core.validators import validate_image_upload
from .models import Feedback, FeedbackAttachment, FeedbackReply


class FeedbackCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = ("category", "title", "description", "page_url", "browser", "browser_version", "operating_system", "device_type", "app_version")
        extra_kwargs = {"title": {"allow_blank": False, "trim_whitespace": True}, "description": {"allow_blank": False, "trim_whitespace": True}}

    def validate_page_url(self, value):
        if value and (not value.startswith("/") or value.startswith("//") or "?" in value or "#" in value):
            raise serializers.ValidationError("Informe somente o caminho da página, sem parâmetros.")
        return value


class AttachmentUploadSerializer(serializers.Serializer):
    file = serializers.FileField()

    def validate_file(self, value):
        original = Path(value.name.replace("\\", "/")).name
        if Path(original).suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
            raise serializers.ValidationError("Envie uma imagem PNG, JPEG ou WebP.")
        normalized = validate_image_upload(value)
        if Path(normalized.name).suffix.lower() != ({".jpeg": ".jpg"}.get(Path(original).suffix.lower(), Path(original).suffix.lower())):
            raise serializers.ValidationError("A extensão não corresponde ao conteúdo da imagem.")
        normalized.original_filename = original[:255]
        normalized.file_type = {".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp"}[Path(normalized.name).suffix]
        return normalized


class FeedbackAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackAttachment
        fields = ("id", "original_filename", "file_type", "created_at")


class FeedbackReplySerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.full_name", read_only=True)

    class Meta:
        model = FeedbackReply
        fields = ("id", "author_name", "message", "is_internal", "created_at")


class FeedbackSerializer(serializers.ModelSerializer):
    public_id = serializers.CharField(read_only=True)
    attachments = FeedbackAttachmentSerializer(many=True, read_only=True)
    replies = serializers.SerializerMethodField()
    user_name = serializers.CharField(source="user.full_name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True)
    company_name = serializers.CharField(source="company.name", read_only=True, default=None)
    professional_name = serializers.CharField(source="professional.name", read_only=True, default=None)

    class Meta:
        model = Feedback
        fields = ("id", "public_id", "user_name", "user_email", "company", "company_name", "professional", "professional_name", "user_type", "category", "title", "description", "status", "priority", "page_url", "browser", "browser_version", "operating_system", "device_type", "app_version", "created_at", "updated_at", "attachments", "replies")
        read_only_fields = fields

    def get_replies(self, obj):
        replies = obj.replies.all()
        if not self.context["request"].user.is_superuser:
            replies = [reply for reply in replies if not reply.is_internal]
        return FeedbackReplySerializer(replies, many=True).data


class FeedbackUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = ("status", "priority")


class FeedbackReplyCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeedbackReply
        fields = ("message", "is_internal")
