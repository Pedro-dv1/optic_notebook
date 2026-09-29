# Customer identity is represented by the global accounts.User model.
from django.conf import settings
from django.db import models

from platform_core.models import UUIDTimestampedModel


class CompanyFavorite(UUIDTimestampedModel):
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="company_favorites")
    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="customer_favorites")

    class Meta:
        ordering = ("-created_at", "id")
        constraints = [models.UniqueConstraint(fields=("customer", "company"), name="unique_customer_company_favorite")]


class FavoriteSuggestionDismissal(UUIDTimestampedModel):
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorite_dismissals")
    company = models.ForeignKey("companies.Company", on_delete=models.CASCADE, related_name="favorite_dismissals")

    class Meta:
        constraints = [models.UniqueConstraint(fields=("customer", "company"), name="unique_customer_favorite_dismissal")]
