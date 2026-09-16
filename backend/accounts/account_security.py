import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from platform_core.exceptions import SecurityFlowError

from . import email_service
from .models import AccountActionAuthorization, AccountSecurityRateLimit, AccountVerificationChallenge, User

security_logger = logging.getLogger("optic_notebook.security")


def mask_email(email):
    local, _, domain = email.partition("@")
    visible = local[:2] if len(local) > 1 else local[:1]
    return f"{visible}***@{domain}"


def _digest(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _identity_digest(value):
    return salted_hmac("account-security-rate-limit", value, algorithm="sha256").hexdigest()


def enforce_security_rate_limit(user, request, endpoint, purpose="", *, limit=5, window_seconds=600):
    # ASVS V2.4: PostgreSQL-backed user and IP buckets work across app workers.
    now = timezone.now()
    epoch = int(now.timestamp())
    window_start = datetime.fromtimestamp(epoch - (epoch % window_seconds), tz=UTC)
    ip = request.META.get("REMOTE_ADDR", "unknown") if request else "unknown"
    buckets = ((_identity_digest(f"user:{user.pk}"), limit), (_identity_digest(f"ip:{ip}"), limit * 4))
    wait = window_seconds - (epoch % window_seconds)
    with transaction.atomic():
        for key_digest, bucket_limit in buckets:
            bucket, created = AccountSecurityRateLimit.objects.select_for_update().get_or_create(
                key_digest=key_digest,
                endpoint=endpoint,
                purpose=purpose,
                window_started_at=window_start,
                defaults={"hits": 1},
            )
            if created:
                continue
            if bucket.hits >= bucket_limit:
                raise SecurityFlowError(
                    "rate_limited",
                    "Muitas tentativas. Aguarde antes de tentar novamente.",
                    status_code=429,
                    wait=wait,
                )
            bucket.hits += 1
            bucket.save(update_fields=("hits",))
    AccountSecurityRateLimit.objects.filter(
        key_digest__in=[key for key, _ in buckets],
        window_started_at__lt=now - timedelta(days=1),
    ).delete()


def _request_metadata(request):
    ip = request.META.get("REMOTE_ADDR", "") if request else ""
    user_agent = request.META.get("HTTP_USER_AGENT", "") if request else ""
    return (_identity_digest(f"ip:{ip}") if ip else "", user_agent[:255])


def _authorization_error(authorization, now):
    if not authorization:
        return SecurityFlowError("authorization_invalid", "A verificação não é válida. Inicie novamente.")
    if authorization.consumed_at:
        return SecurityFlowError("authorization_used", "Esta verificação já foi utilizada. Inicie novamente.")
    if authorization.expires_at <= now:
        return SecurityFlowError("authorization_expired", "A verificação expirou. Inicie novamente.")
    return None


def _find_authorization(user, raw_token, purpose, *, for_update=False):
    queryset = AccountActionAuthorization.objects
    if for_update:
        queryset = queryset.select_for_update()
    return queryset.filter(user=user, purpose=purpose, token_digest=_digest(raw_token)).first()


def _cooldown_error(seconds):
    return SecurityFlowError(
        "resend_cooldown",
        "Aguarde antes de solicitar outro código.",
        status_code=429,
        wait=seconds,
    )


def request_otp(user, request, purpose, recipient, *, authorization=None, target_email=""):
    enforce_security_rate_limit(user, request, "otp_request", purpose)
    now = timezone.now()
    ip_digest, user_agent = _request_metadata(request)
    code = f"{secrets.randbelow(1_000_000):06d}"
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)
        locked_authorization = None
        if authorization:
            locked_authorization = AccountActionAuthorization.objects.select_for_update().filter(pk=authorization.pk).first()
            error = _authorization_error(locked_authorization, now)
            if error:
                raise error
        previous = AccountVerificationChallenge.objects.filter(
            user=user,
            purpose=purpose,
            consumed_at__isnull=True,
        ).order_by("-created_at").first()
        if previous:
            last_activity = previous.sent_at or previous.created_at
            remaining = settings.ACCOUNT_OTP_RESEND_SECONDS - int((now - last_activity).total_seconds())
            if remaining > 0:
                raise _cooldown_error(remaining)
        challenge = AccountVerificationChallenge.objects.create(
            user=user,
            purpose=purpose,
            code_hash=make_password(code),
            target_email=target_email,
            authorization=locked_authorization,
            expires_at=now + settings.ACCOUNT_OTP_TTL,
            request_ip_digest=ip_digest,
            request_user_agent=user_agent,
        )

    try:
        email_service.send_security_otp(
            to=recipient,
            purpose=purpose,
            code=code,
            expires_minutes=int(settings.ACCOUNT_OTP_TTL.total_seconds() // 60),
            event_id=challenge.id,
        )
    except email_service.EmailDeliveryError as exc:
        AccountVerificationChallenge.objects.filter(pk=challenge.pk, sent_at__isnull=True).delete()
        # ASVS V16.2/V16.3: log only safe delivery metadata; never recipient, OTP, token, or provider body.
        security_logger.warning(
            "security_notification_failed user_id=%s event=otp purpose=%s provider_status=%s provider_error=%s",
            user.id,
            purpose,
            exc.provider_status if exc.provider_status is not None else "unavailable",
            exc.provider_error or "unknown",
        )
        raise SecurityFlowError(
            "email_delivery_unavailable",
            "Não foi possível enviar o código agora. Tente novamente em alguns instantes.",
            status_code=503,
        ) from exc

    activation_error = None
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)
        challenge = AccountVerificationChallenge.objects.select_for_update().get(pk=challenge.pk)
        if challenge.authorization_id:
            locked_authorization = AccountActionAuthorization.objects.select_for_update().filter(
                pk=challenge.authorization_id
            ).first()
            error = _authorization_error(locked_authorization, timezone.now())
            if error:
                challenge.delete()
                activation_error = error
            else:
                locked_authorization.email_candidate = target_email
                locked_authorization.save(update_fields=("email_candidate",))
        if not activation_error:
            activated_at = timezone.now()
            AccountVerificationChallenge.objects.filter(
                user=user,
                purpose=purpose,
                consumed_at__isnull=True,
            ).exclude(pk=challenge.pk).update(consumed_at=activated_at)
            challenge.sent_at = activated_at
            challenge.save(update_fields=("sent_at",))
    if activation_error:
        raise activation_error

    event = "password_change_requested" if purpose == AccountVerificationChallenge.Purpose.PASSWORD_CHANGE else "email_change_requested"
    security_logger.info("%s user_id=%s purpose=%s", event, user.id, purpose)
    return {
        "challenge_id": challenge.id,
        "masked_email": mask_email(recipient),
        "expires_in": int(settings.ACCOUNT_OTP_TTL.total_seconds()),
        "resend_after": settings.ACCOUNT_OTP_RESEND_SECONDS,
    }


def _consume_challenge_locked(user, purpose, challenge_id, code, now, *, authorization=None):
    challenge = AccountVerificationChallenge.objects.select_for_update().filter(
        pk=challenge_id,
        user=user,
        purpose=purpose,
    ).first()
    if not challenge or (authorization and challenge.authorization_id != authorization.id):
        return None, SecurityFlowError("otp_invalid", "Esse código não é válido.")
    if challenge.consumed_at:
        return None, SecurityFlowError("otp_used", "Esse código não está mais disponível. Solicite um novo.")
    if not challenge.sent_at or challenge.expires_at <= now:
        return None, SecurityFlowError("otp_expired", "O código expirou. Solicite um novo.")
    if not check_password(code, challenge.code_hash):
        challenge.failed_attempts += 1
        fields = ["failed_attempts"]
        if challenge.failed_attempts >= settings.ACCOUNT_OTP_MAX_ATTEMPTS:
            challenge.consumed_at = now
            fields.append("consumed_at")
        challenge.save(update_fields=fields)
        if challenge.failed_attempts >= settings.ACCOUNT_OTP_MAX_ATTEMPTS:
            return None, SecurityFlowError(
                "otp_attempts_exceeded",
                "Muitas tentativas. Solicite um novo código.",
                status_code=429,
            )
        return None, SecurityFlowError("otp_invalid", "Esse código não é válido.")
    challenge.consumed_at = now
    challenge.save(update_fields=("consumed_at",))
    return challenge, None


def verify_identity_otp(user, request, purpose, challenge_id, code):
    enforce_security_rate_limit(user, request, "otp_verify", purpose, limit=15)
    authorization_purpose = {
        AccountVerificationChallenge.Purpose.PASSWORD_CHANGE: AccountActionAuthorization.Purpose.PASSWORD_CHANGE,
        AccountVerificationChallenge.Purpose.EMAIL_CHANGE_CURRENT: AccountActionAuthorization.Purpose.EMAIL_CHANGE,
    }[purpose]
    now = timezone.now()
    raw_token = secrets.token_urlsafe(32)
    with transaction.atomic():
        User.objects.select_for_update().get(pk=user.pk)
        challenge, error = _consume_challenge_locked(user, purpose, challenge_id, code, now)
        if not error:
            AccountActionAuthorization.objects.filter(
                user=user,
                purpose=authorization_purpose,
                consumed_at__isnull=True,
            ).update(consumed_at=now)
            AccountActionAuthorization.objects.create(
                user=user,
                purpose=authorization_purpose,
                token_digest=_digest(raw_token),
                expires_at=now + settings.ACCOUNT_AUTHORIZATION_TTL,
            )
    if error:
        raise error
    event = "password_change_verified" if purpose == AccountVerificationChallenge.Purpose.PASSWORD_CHANGE else "email_change_verified"
    security_logger.info("%s user_id=%s", event, user.id)
    return {
        "authorization_token": raw_token,
        "expires_in": int(settings.ACCOUNT_AUTHORIZATION_TTL.total_seconds()),
    }


def request_new_email_otp(user, request, raw_authorization, new_email):
    enforce_security_rate_limit(
        user,
        request,
        "email_change_new_request",
        AccountActionAuthorization.Purpose.EMAIL_CHANGE,
    )
    if new_email == user.email:
        raise SecurityFlowError("email_unchanged", "Informe um e-mail diferente do atual.")
    if User.objects.filter(email=new_email).exists():
        raise SecurityFlowError("email_in_use", "Este e-mail já está em uso.", status_code=409)
    now = timezone.now()
    with transaction.atomic():
        authorization = _find_authorization(
            user,
            raw_authorization,
            AccountActionAuthorization.Purpose.EMAIL_CHANGE,
            for_update=True,
        )
        error = _authorization_error(authorization, now)
        if error:
            raise error
    return request_otp(
        user,
        request,
        AccountVerificationChallenge.Purpose.EMAIL_CHANGE_NEW,
        new_email,
        authorization=authorization,
        target_email=new_email,
    )


def confirm_new_email(user, request, raw_authorization, challenge_id, code):
    purpose = AccountVerificationChallenge.Purpose.EMAIL_CHANGE_NEW
    enforce_security_rate_limit(user, request, "email_change_confirm", purpose)
    now = timezone.now()
    try:
        with transaction.atomic():
            locked_user = User.objects.select_for_update().get(pk=user.pk)
            old_email = locked_user.email
            authorization = _find_authorization(
                locked_user,
                raw_authorization,
                AccountActionAuthorization.Purpose.EMAIL_CHANGE,
                for_update=True,
            )
            error = _authorization_error(authorization, now)
            if not error:
                challenge, error = _consume_challenge_locked(
                    locked_user,
                    purpose,
                    challenge_id,
                    code,
                    now,
                    authorization=authorization,
                )
            if not error:
                new_email = challenge.target_email
                if not new_email or authorization.email_candidate != new_email:
                    error = SecurityFlowError("authorization_invalid", "A verificação não é válida. Inicie novamente.")
                else:
                    locked_user.email = new_email
                    locked_user.save(update_fields=("email",))
                    authorization.consumed_at = now
                    authorization.save(update_fields=("consumed_at",))
                    AccountActionAuthorization.objects.filter(
                        user=locked_user,
                        purpose=AccountActionAuthorization.Purpose.EMAIL_CHANGE,
                        consumed_at__isnull=True,
                    ).update(consumed_at=now)
                    AccountVerificationChallenge.objects.filter(
                        user=locked_user,
                        purpose__in=(
                            AccountVerificationChallenge.Purpose.EMAIL_CHANGE_CURRENT,
                            AccountVerificationChallenge.Purpose.EMAIL_CHANGE_NEW,
                        ),
                        consumed_at__isnull=True,
                    ).update(consumed_at=now)
    except IntegrityError as exc:
        raise SecurityFlowError("email_in_use", "Este e-mail já está em uso.", status_code=409) from exc
    if error:
        raise error
    security_logger.info("email_changed user_id=%s", user.id)
    try:
        email_service.send_email_changed(to=old_email, event_id=authorization.id)
    except email_service.EmailDeliveryError:
        security_logger.warning("security_notification_failed user_id=%s event=email_changed", user.id)
    return locked_user


def confirm_password_change(user, request, raw_authorization, new_password):
    enforce_security_rate_limit(user, request, "password_change_confirm", AccountActionAuthorization.Purpose.PASSWORD_CHANGE)
    now = timezone.now()
    with transaction.atomic():
        locked_user = User.objects.select_for_update().get(pk=user.pk)
        authorization = _find_authorization(
            locked_user,
            raw_authorization,
            AccountActionAuthorization.Purpose.PASSWORD_CHANGE,
            for_update=True,
        )
        error = _authorization_error(authorization, now)
        if not error:
            # ASVS V6.2/V7.4: Django hashes the password and every prior JWT session is revoked.
            locked_user.set_password(new_password)
            locked_user.auth_version += 1
            locked_user.save(update_fields=("password", "auth_version"))
            authorization.consumed_at = now
            authorization.save(update_fields=("consumed_at",))
            AccountActionAuthorization.objects.filter(user=locked_user, consumed_at__isnull=True).update(consumed_at=now)
            AccountVerificationChallenge.objects.filter(user=locked_user, consumed_at__isnull=True).update(consumed_at=now)
            for token in OutstandingToken.objects.filter(user=locked_user):
                BlacklistedToken.objects.get_or_create(token=token)
    if error:
        raise error
    security_logger.info("password_changed user_id=%s", user.id)
    try:
        email_service.send_password_changed(to=locked_user.email, event_id=authorization.id)
    except email_service.EmailDeliveryError:
        security_logger.warning("security_notification_failed user_id=%s event=password_changed", user.id)
    return locked_user
