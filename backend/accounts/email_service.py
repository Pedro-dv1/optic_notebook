import html
import json
import re
from urllib import error, request

from django.conf import settings


class EmailDeliveryError(Exception):
    def __init__(self, message, *, provider_status=None, provider_error=""):
        super().__init__(message)
        self.provider_status = provider_status
        self.provider_error = provider_error


def _provider_error(body):
    try:
        payload = json.loads(body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return "invalid_response"
    if not isinstance(payload, dict):
        return "invalid_response"
    value = payload.get("name") or payload.get("code") or payload.get("statusCode")
    return re.sub(r"[^A-Za-z0-9_.-]", "_", str(value))[:64] if value is not None else "rejected"


def _layout(title, intro, body, footer):
    safe_title = html.escape(title)
    return f"""<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f8fd;font-family:Arial,sans-serif;color:#071044">
<div style="display:none;max-height:0;overflow:hidden">{html.escape(intro)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f8fd;padding:32px 12px">
<tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #d8e5f4;border-radius:14px;overflow:hidden">
<tr><td style="padding:22px 28px;background:#087cf0;color:#fff;font-size:20px;font-weight:700">OpticNoteBook</td></tr>
<tr><td style="padding:30px 28px"><h1 style="margin:0 0 14px;font-size:24px;line-height:1.25">{safe_title}</h1>{body}<p style="margin:28px 0 0;color:#7182a8;font-size:13px;line-height:1.6">{html.escape(footer)}</p></td></tr>
</table></td></tr></table></body></html>"""


def _send(to, subject, html_body, text_body, idempotency_key):
    # ASVS V13.2/V13.3: the server owns the timed TLS request and reads credentials only from settings.
    if settings.EMAIL_PROVIDER != "resend" or not settings.RESEND_API_KEY or not settings.DEFAULT_FROM_EMAIL:
        raise EmailDeliveryError("Email provider is not configured.")
    payload = json.dumps(
        {
            "from": settings.DEFAULT_FROM_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html_body,
            "text": text_body,
        }
    ).encode("utf-8")
    email_request = request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
            "Idempotency-Key": idempotency_key,
            "User-Agent": "OpticNoteBook/1.0",
        },
        method="POST",
    )
    try:
        with request.urlopen(email_request, timeout=settings.EMAIL_TIMEOUT_SECONDS) as response:
            status = response.status
            body = response.read(65_536)
    except error.HTTPError as exc:
        # ASVS V13.4/V16.5: retain safe provider metadata for operators, never its body or request headers.
        raise EmailDeliveryError(
            "Email provider rejected the request.",
            provider_status=exc.code,
            provider_error=_provider_error(exc.read(65_536)),
        ) from exc
    except (error.URLError, TimeoutError) as exc:
        reason = getattr(exc, "reason", exc)
        raise EmailDeliveryError(
            "Email provider request failed.",
            provider_error=type(reason).__name__,
        ) from exc
    try:
        result = json.loads(body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise EmailDeliveryError(
            "Email provider returned an invalid response.",
            provider_status=status,
            provider_error="invalid_response",
        ) from exc
    if not 200 <= status < 300 or not isinstance(result, dict) or not result.get("id"):
        raise EmailDeliveryError(
            "Email provider returned an unexpected response.",
            provider_status=status,
            provider_error="unexpected_response",
        )


def send_security_otp(*, to, purpose, code, expires_minutes, event_id):
    content = {
        "PASSWORD_CHANGE": (
            "Código de verificação — OpticNoteBook",
            "Use este código para confirmar a alteração da sua senha.",
        ),
        "EMAIL_CHANGE_CURRENT": (
            "Confirme a alteração do seu e-mail — OpticNoteBook",
            "Use este código para confirmar que a conta pertence a você.",
        ),
        "EMAIL_CHANGE_NEW": (
            "Confirme seu novo e-mail — OpticNoteBook",
            "Use este código para confirmar o novo endereço da sua conta.",
        ),
    }
    subject, intro = content[purpose]
    safe_code = html.escape(code)
    body = (
        f'<p style="margin:0;color:#43557e;line-height:1.6">{html.escape(intro)}</p>'
        f'<p style="margin:24px 0;text-align:center;font-size:34px;font-weight:800;letter-spacing:10px;color:#087cf0">{safe_code}</p>'
        f'<p style="margin:0;color:#43557e;line-height:1.6">O código expira em {expires_minutes} minutos e só pode ser usado uma vez.</p>'
    )
    footer = "Se você não solicitou esta ação, ignore esta mensagem. Nunca compartilhe este código."
    text_body = f"{intro}\n\nCódigo: {code}\nExpira em {expires_minutes} minutos.\n\n{footer}"
    _send(to, subject, _layout("Código de verificação", intro, body, footer), text_body, f"account-otp-{event_id}")


def send_password_changed(*, to, event_id):
    subject = "Sua senha foi alterada — OpticNoteBook"
    intro = "A senha da sua conta foi alterada com sucesso."
    body = (
        '<p style="margin:0;color:#43557e;line-height:1.6">A senha da sua conta foi alterada e as sessões anteriores foram encerradas.</p>'
        '<p style="margin:16px 0 0;color:#43557e;line-height:1.6">Se não foi você, entre em contato com o suporte imediatamente.</p>'
    )
    footer = "Por segurança, a OpticNoteBook nunca envia senhas por e-mail."
    _send(to, subject, _layout("Senha alterada", intro, body, footer), f"{intro}\nSe não foi você, contate o suporte imediatamente.\n\n{footer}", f"password-changed-{event_id}")


def send_email_changed(*, to, event_id):
    subject = "O e-mail da sua conta foi alterado — OpticNoteBook"
    intro = "O endereço de e-mail da sua conta foi alterado."
    body = (
        '<p style="margin:0;color:#43557e;line-height:1.6">Este endereço não será mais usado para entrar na conta.</p>'
        '<p style="margin:16px 0 0;color:#43557e;line-height:1.6">Se você não reconhece esta alteração, entre em contato com o suporte imediatamente.</p>'
    )
    footer = "Esta é uma notificação de segurança; nenhuma ação é necessária se a alteração foi sua."
    _send(to, subject, _layout("E-mail alterado", intro, body, footer), f"{intro}\nSe não foi você, contate o suporte imediatamente.\n\n{footer}", f"email-changed-{event_id}")
