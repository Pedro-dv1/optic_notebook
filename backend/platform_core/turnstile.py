import hashlib
import json
from urllib import error, parse, request as urlrequest

from django.conf import settings
from django.core.cache import cache
from rest_framework import serializers


def _siteverify(payload):
    body = parse.urlencode(payload).encode("utf-8")
    req = urlrequest.Request(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urlrequest.urlopen(req, timeout=settings.TURNSTILE_TIMEOUT_SECONDS) as response:
        return json.loads(response.read(65_536).decode("utf-8"))


def validate_turnstile(token, request, action):
    token = (token or "").strip()
    if not settings.TURNSTILE_REQUIRED:
        return
    if not token:
        raise serializers.ValidationError({"turnstile_token": "Conclua a verificação anti-robô."})
    if not settings.TURNSTILE_SECRET_KEY:
        raise serializers.ValidationError({"turnstile_token": "A verificação anti-robô está indisponível. Tente novamente."})

    token_digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    cache_key = f"turnstile-used:{token_digest}"
    if cache.get(cache_key):
        raise serializers.ValidationError({"turnstile_token": "A verificação anti-robô expirou. Tente novamente."})

    payload = {"secret": settings.TURNSTILE_SECRET_KEY, "response": token}
    if request:
        remote_ip = request.META.get("REMOTE_ADDR")
        if remote_ip:
            payload["remoteip"] = remote_ip
    try:
        result = _siteverify(payload)
    except (error.URLError, TimeoutError, ValueError, json.JSONDecodeError):
        raise serializers.ValidationError({"turnstile_token": "A verificação anti-robô está indisponível. Tente novamente."})

    hostname = result.get("hostname")
    valid_hostname = not settings.TURNSTILE_EXPECTED_HOSTNAMES or hostname in settings.TURNSTILE_EXPECTED_HOSTNAMES
    valid_action = not result.get("action") or result.get("action") == action
    if not result.get("success") or not valid_hostname or not valid_action:
        raise serializers.ValidationError({"turnstile_token": "A verificação anti-robô falhou. Tente novamente."})
    cache.set(cache_key, True, timeout=300)


def validate_public_submission(attrs, context, action, *, required=True):
    honeypot = attrs.pop("website", "")
    token = attrs.pop("turnstile_token", "")
    if honeypot:
        raise serializers.ValidationError("A verificação anti-robô falhou. Recarregue a página e tente novamente.")
    if required:
        validate_turnstile(token, context.get("request"), action)
    return attrs
