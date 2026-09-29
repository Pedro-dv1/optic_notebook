from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from io import BytesIO
from PIL import Image

from accounts.models import User
from .models import Feedback, FeedbackReply


class FeedbackAPITests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(email="feedback-owner@example.com", full_name="Owner", password="password-test-123")
        self.other = User.objects.create_user(email="feedback-other@example.com", full_name="Other", password="password-test-123")
        self.admin = User.objects.create_user(email="feedback-admin@example.com", full_name="Admin", password="password-test-123", is_superuser=True, is_staff=True)

    def create_feedback(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post("/api/v1/feedback/", {
            "category": "BUG", "title": "Falha na página", "description": "A tela não abre.",
            "user_type": "ADMIN", "status": "COMPLETED", "priority": "CRITICAL", "company": "forged",
        })
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["public_id"].startswith("FB-"))
        feedback = Feedback.objects.get(pk=response.data["id"])
        self.assertEqual((feedback.user, feedback.user_type, feedback.status, feedback.priority),
                         (self.owner, "CLIENT", "NEW", "MEDIUM"))
        self.assertIsNone(feedback.company)
        return feedback

    def test_create_and_only_own_feedback_visible(self):
        feedback = self.create_feedback()
        Feedback.objects.create(user=self.other, user_type="CLIENT", category="OTHER", title="Outro", description="Mensagem")
        response = self.client.get("/api/v1/feedback/mine/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data["results"]], [feedback.id])

    def test_other_user_cannot_read_or_change_feedback(self):
        feedback = self.create_feedback()
        self.client.force_authenticate(self.other)
        url = f"/api/v1/feedback/{feedback.id}/"
        self.assertEqual(self.client.get(url).status_code, 404)
        self.assertEqual(self.client.patch(url, {"status": "COMPLETED"}).status_code, 405)
        self.assertEqual(self.client.post(url + "attachments/", {}).status_code, 404)

    def test_platform_can_list_update_and_reply_without_leaking_internal_notes(self):
        feedback = self.create_feedback()
        self.client.force_authenticate(self.admin)
        listing = self.client.get("/api/v1/platform/feedback/", {"category": "BUG", "search": feedback.public_id})
        self.assertEqual(listing.status_code, 200)
        self.assertEqual(listing.data["count"], 1)
        self.assertEqual(self.client.get("/api/v1/platform/feedback/", {"company": "sem empresa"}).data["count"], 0)
        url = f"/api/v1/platform/feedback/{feedback.id}/"
        updated = self.client.patch(url, {"status": "PLANNED", "priority": "HIGH", "title": "forged"})
        self.assertEqual(updated.status_code, 200)
        feedback.refresh_from_db()
        self.assertEqual((feedback.status, feedback.priority, feedback.title), ("PLANNED", "HIGH", "Falha na página"))
        public = self.client.post(url + "reply/", {"message": "Vamos corrigir.", "is_internal": False})
        internal = self.client.post(url + "reply/", {"message": "Investigar logs.", "is_internal": True})
        self.assertEqual((public.status_code, internal.status_code), (201, 201))
        self.assertEqual(FeedbackReply.objects.filter(feedback=feedback).count(), 2)
        self.client.force_authenticate(self.owner)
        detail = self.client.get(f"/api/v1/feedback/{feedback.id}/")
        self.assertEqual([reply["message"] for reply in detail.data["replies"]], ["Vamos corrigir."])
        self.assertNotIn("Investigar logs.", str(detail.data))

    def test_upload_rejects_active_content_and_invalid_image(self):
        feedback = self.create_feedback()
        url = f"/api/v1/feedback/{feedback.id}/attachments/"
        for name, content, mime in (("active.svg", b"<svg onload='alert(1)'/>", "image/svg+xml"),
                                    ("fake.png", b"not an image", "image/png")):
            response = self.client.post(url, {"file": SimpleUploadedFile(name, content, content_type=mime)}, format="multipart")
            self.assertEqual(response.status_code, 400)
        self.assertEqual(feedback.attachments.count(), 0)

    def test_valid_attachment_is_private(self):
        feedback = self.create_feedback()
        image = BytesIO()
        Image.new("RGB", (2, 2), "blue").save(image, format="PNG")
        response = self.client.post(f"/api/v1/feedback/{feedback.id}/attachments/", {
            "file": SimpleUploadedFile("screen.png", image.getvalue(), content_type="image/png"),
        }, format="multipart")
        self.assertEqual(response.status_code, 201)
        attachment = feedback.attachments.get()
        self.addCleanup(attachment.file.storage.delete, attachment.file.name)
        path = f"/api/v1/feedback/{feedback.id}/attachments/{attachment.id}/download/"
        download = self.client.get(path)
        self.assertEqual(download.status_code, 200)
        download.close()
        self.client.force_authenticate(self.other)
        self.assertEqual(self.client.get(path).status_code, 404)
        self.client.force_authenticate(self.admin)
        download = self.client.get(f"/api/v1/platform/feedback/{feedback.id}/attachments/{attachment.id}/download/")
        self.assertEqual(download.status_code, 200)
        download.close()
