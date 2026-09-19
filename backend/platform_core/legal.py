from rest_framework import serializers

from .models import LegalAcceptance

TERMS_VERSION = "2026-09-16"
PRIVACY_VERSION = "2026-09-16"
LEGAL_ACCEPTANCE_MESSAGE = "É necessário aceitar os Termos de Uso e a Política de Privacidade para continuar."


def current_legal_versions():
    return {
        LegalAcceptance.DocumentType.TERMS: TERMS_VERSION,
        LegalAcceptance.DocumentType.PRIVACY: PRIVACY_VERSION,
    }


def current_acceptance_types(user):
    if not user or not user.is_authenticated:
        return set()
    versions = current_legal_versions()
    return set(
        LegalAcceptance.objects.filter(
            user=user,
            document_type__in=versions,
        )
        .values_list("document_type", "document_version")
    ) & set(versions.items())


def validate_legal_acceptance(attrs, user=None):
    flags = {
        LegalAcceptance.DocumentType.TERMS: attrs.pop("terms_accepted", False),
        LegalAcceptance.DocumentType.PRIVACY: attrs.pop("privacy_accepted", False),
    }
    accepted = {document_type for document_type, _ in current_acceptance_types(user)}
    missing = {document_type for document_type in current_legal_versions() if document_type not in accepted}
    # ASVS V2.2/V2.3: the API enforces every missing document independently; UI state is not trusted.
    if any(not flags[document_type] for document_type in missing):
        raise serializers.ValidationError({"legal_acceptance": LEGAL_ACCEPTANCE_MESSAGE})
    return {document_type for document_type in missing if flags[document_type]}


def record_current_acceptances(document_types, *, context, user=None, company=None, appointment=None):
    versions = current_legal_versions()
    for document_type in document_types:
        lookup = {
            "document_type": document_type,
            "document_version": versions[document_type],
        }
        if user:
            lookup["user"] = user
        elif appointment:
            lookup["appointment"] = appointment
        else:
            raise ValueError("Legal acceptance requires a user or appointment.")
        LegalAcceptance.objects.get_or_create(
            **lookup,
            defaults={"context": context, "company": company, "appointment": appointment},
        )
