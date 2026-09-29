from django.db.models import Q
from uuid import UUID
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from platform_core.permissions import IsSuperuser, company_for_user, professional_for_user
from platform_core.throttles import WindowScopedRateThrottle
from .models import Feedback, FeedbackAttachment
from .serializers import (
    AttachmentUploadSerializer, FeedbackAttachmentSerializer, FeedbackCreateSerializer,
    FeedbackReplyCreateSerializer, FeedbackReplySerializer, FeedbackSerializer, FeedbackUpdateSerializer,
)


class FeedbackViewSet(mixins.CreateModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = (IsAuthenticated,)
    queryset = Feedback.objects.select_related("user", "company", "professional").prefetch_related("attachments", "replies__author")

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)

    def get_serializer_class(self):
        return FeedbackCreateSerializer if self.action == "create" else FeedbackSerializer

    def get_throttles(self):
        if self.action in ("create", "attachments"):
            self.throttle_scope = "feedback_create" if self.action == "create" else "feedback_upload"
            return [WindowScopedRateThrottle()]
        return super().get_throttles()

    def perform_create(self, serializer):
        company = company_for_user(self.request.user)
        professional = professional_for_user(self.request.user)
        user_type = Feedback.UserType.ADMIN if company else Feedback.UserType.PROFESSIONAL if professional else Feedback.UserType.CLIENT
        serializer.save(user=self.request.user, user_type=user_type, company=company or (professional.company if professional else None), professional=professional)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(FeedbackSerializer(serializer.instance, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=("get",))
    def mine(self, request):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response(FeedbackSerializer(page, many=True, context={"request": request}).data)

    @action(detail=True, methods=("post",), parser_classes=(MultiPartParser, FormParser))
    def attachments(self, request, pk=None):
        feedback = self.get_object()
        if feedback.attachments.count() >= 3:
            return Response({"file": ["Limite de 3 imagens por feedback."]}, status=400)
        serializer = AttachmentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        file = serializer.validated_data["file"]
        attachment = FeedbackAttachment.objects.create(
            feedback=feedback, file=file, original_filename=file.original_filename, file_type=file.file_type,
        )
        return Response(FeedbackAttachmentSerializer(attachment).data, status=201)

    @action(detail=True, methods=("get",), url_path=r"attachments/(?P<attachment_id>\d+)/download")
    def download(self, request, pk=None, attachment_id=None):
        attachment = get_object_or_404(FeedbackAttachment, feedback=self.get_object(), pk=attachment_id)
        return FileResponse(attachment.file.open("rb"), as_attachment=True, filename=attachment.original_filename, content_type=attachment.file_type)


class PlatformFeedbackViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = (IsSuperuser,)
    queryset = Feedback.objects.select_related("user", "company", "professional").prefetch_related("attachments", "replies__author")
    http_method_names = ("get", "patch", "post", "head", "options")

    def get_serializer_class(self):
        return FeedbackUpdateSerializer if self.action == "partial_update" else FeedbackSerializer

    def get_throttles(self):
        if self.action == "reply":
            self.throttle_scope = "feedback_reply"
            return [WindowScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        queryset = self.queryset
        if self.action != "list":
            return queryset
        for field in ("category", "status", "priority", "user_type"):
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})
        company = self.request.query_params.get("company", "").strip()[:160]
        if company:
            try:
                queryset = queryset.filter(company_id=UUID(company))
            except ValueError:
                queryset = queryset.filter(company__name__icontains=company)
        search = self.request.query_params.get("search", "").strip()[:160]
        if search:
            query = Q(title__icontains=search) | Q(description__icontains=search) | Q(user__email__icontains=search) | Q(user__full_name__icontains=search)
            if search.upper().startswith("FB-") and search[3:].isdigit() and len(search[3:]) <= 18:
                query |= Q(pk=int(search[3:]))
            queryset = queryset.filter(query)
        ordering = self.request.query_params.get("ordering", "-created_at")
        if ordering in ("created_at", "-created_at", "updated_at", "-updated_at", "priority", "-priority"):
            queryset = queryset.order_by(ordering, "-id")
        return queryset

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(FeedbackSerializer(instance, context={"request": request}).data)

    @action(detail=True, methods=("post",))
    def reply(self, request, pk=None):
        feedback = self.get_object()
        serializer = FeedbackReplyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reply = serializer.save(feedback=feedback, author=request.user)
        return Response(FeedbackReplySerializer(reply).data, status=201)

    @action(detail=True, methods=("get",), url_path=r"attachments/(?P<attachment_id>\d+)/download")
    def download(self, request, pk=None, attachment_id=None):
        attachment = get_object_or_404(FeedbackAttachment, feedback=self.get_object(), pk=attachment_id)
        return FileResponse(attachment.file.open("rb"), as_attachment=True, filename=attachment.original_filename, content_type=attachment.file_type)
