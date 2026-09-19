import re

from PIL import Image, UnidentifiedImageError
from rest_framework import serializers

RESERVED_SLUGS = {"admin", "api", "cadastro", "cliente", "empreendedor", "login", "platform"}


def normalize_phone(value):
    compact = re.sub(r"[\s().-]", "", value.strip())
    if compact.startswith("+"):
        digits = compact[1:]
        prefix = "+"
    else:
        digits = compact
        prefix = ""
    if not digits.isdigit() or not 8 <= len(digits) <= 15:
        raise serializers.ValidationError("Informe um telefone válido com 8 a 15 dígitos.")
    return f"{prefix}{digits}"


def normalize_tax_identifier(value):
    if not value:
        return ""
    digits = re.sub(r"[./-]", "", value.strip())
    if len(digits) != 14 or not digits.isdigit():
        raise serializers.ValidationError("O CNPJ deve conter 14 dígitos.")
    return digits


def validate_company_slug(value):
    if value.lower() in RESERVED_SLUGS:
        raise serializers.ValidationError("Este endereço é reservado pela plataforma.")
    return value.lower()


def validate_hex_color(value):
    if not re.fullmatch(r"#[0-9A-Fa-f]{6}", value or ""):
        raise serializers.ValidationError("Use uma cor hexadecimal no formato #RRGGBB.")
    return value.upper()


def validate_image_upload(value, *, max_size=2 * 1024 * 1024):
    """Validate actual image content before it reaches configured storage."""
    # ASVS V5.2: bound uploads and verify content instead of trusting the filename/MIME header.
    if value.size > max_size:
        raise serializers.ValidationError("A imagem deve ter no máximo 2 MB.")
    extensions = {"PNG": "png", "JPEG": "jpg", "WEBP": "webp"}
    try:
        with Image.open(value) as image:
            image_format = image.format
            if image.width > 4096 or image.height > 4096 or image.width * image.height > 16_000_000:
                raise serializers.ValidationError("A imagem deve ter no máximo 4096 × 4096 pixels.")
            image.verify()
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError):
        raise serializers.ValidationError("Envie uma imagem PNG, JPEG ou WebP válida.")
    finally:
        value.seek(0)
    extension = extensions.get(image_format)
    if not extension:
        raise serializers.ValidationError("Envie uma imagem PNG, JPEG ou WebP.")
    value.name = f"{value.name.rsplit('.', 1)[0]}.{extension}"
    return value
