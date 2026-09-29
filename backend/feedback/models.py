import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.db import models


def private_storage():
    return FileSystemStorage(location=settings.BASE_DIR / "private_feedback")


def attachment_path(instance, filename):
    return f"{instance.feedback_id}/{uuid.uuid4().hex}{Path(filename).suffix.lower()}"


class Feedback(models.Model):
    class UserType(models.TextChoices):
        CLIENT = "CLIENT", "Cliente"
        ADMIN = "ADMIN", "Comerciante/Admin"
        PROFESSIONAL = "PROFESSIONAL", "Profissional"

    class Category(models.TextChoices):
        BUG = "BUG", "Bug"
        SUGGESTION = "SUGGESTION", "Sugestão"
        FEATURE_REQUEST = "FEATURE_REQUEST", "Funcionalidade"
        UX = "UX", "Usabilidade"
        OTHER = "OTHER", "Outro"

    class Status(models.TextChoices):
        NEW = "NEW", "Novo"
        REVIEWING = "REVIEWING", "Em análise"
        PLANNED = "PLANNED", "Planejado"
        IN_PROGRESS = "IN_PROGRESS", "Em desenvolvimento"
        COMPLETED = "COMPLETED", "Concluído"
        REJECTED = "REJECTED", "Não planejado"

    class Priority(models.TextChoices):
        LOW = "LOW", "Baixa"
        MEDIUM = "MEDIUM", "Média"
        HIGH = "HIGH", "Alta"
        CRITICAL = "CRITICAL", "Crítica"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="feedbacks")
    company = models.ForeignKey("companies.Company", null=True, blank=True, on_delete=models.SET_NULL)
    professional = models.ForeignKey("professionals.Professional", null=True, blank=True, on_delete=models.SET_NULL)
    user_type = models.CharField(max_length=16, choices=UserType.choices)
    category = models.CharField(max_length=20, choices=Category.choices)
    title = models.CharField(max_length=160)
    description = models.TextField(max_length=5000)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.NEW)
    priority = models.CharField(max_length=8, choices=Priority.choices, default=Priority.MEDIUM)
    page_url = models.CharField(max_length=500, blank=True)
    browser = models.CharField(max_length=80, blank=True)
    browser_version = models.CharField(max_length=40, blank=True)
    operating_system = models.CharField(max_length=80, blank=True)
    device_type = models.CharField(max_length=30, blank=True)
    app_version = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at", "-id")
        indexes = [models.Index(fields=("user", "-created_at"))]

    @property
    def public_id(self):
        return f"FB-{self.pk:06d}" if self.pk else ""

    def __str__(self):
        return f"{self.public_id} {self.title}"


class FeedbackAttachment(models.Model):
    feedback = models.ForeignKey(Feedback, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to=attachment_path, storage=private_storage)
    original_filename = models.CharField(max_length=255)
    file_type = models.CharField(max_length=40)
    created_at = models.DateTimeField(auto_now_add=True)


class FeedbackReply(models.Model):
    feedback = models.ForeignKey(Feedback, on_delete=models.CASCADE, related_name="replies")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    message = models.TextField(max_length=5000)
    is_internal = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at", "id")
