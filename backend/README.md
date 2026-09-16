# OpticNoteBook backend

Django REST API for the first OpticNoteBook scheduling release. The project uses PostgreSQL only and keeps company-owned data explicitly scoped by `Company`.

## Local setup

1. Create and activate a Python 3.12 virtual environment.
2. Install direct dependencies with `python -m pip install -r requirements.txt`.
3. Copy `.env.example` to `.env` and provide local values. Never commit `.env`.
4. Create the PostgreSQL database and role named in `.env`.
5. Run `python manage.py migrate` and `python manage.py check`.

Create the first platform owner with `python manage.py createsuperuser`. Platform privileges are determined only by Django's `is_superuser` flag; `PLATFORM_ADMIN_EMAIL` does not grant access.

Tests use Django's PostgreSQL test database and therefore require the configured database role to have permission to create and drop a dedicated test database:

```powershell
python manage.py test
python manage.py test --tag=adversarial_1
python manage.py test --tag=adversarial_2
```

## API

All routes use `/api/v1/`.

- Auth: `auth/csrf/`, `auth/login/`, `auth/refresh/`, `auth/logout/`, `auth/me/`. Login returns access plus user; refresh lives only in the `obn_refresh` HttpOnly cookie.
- Platform owner: `platform/metrics/`, `platform/registration-keys/`, `platform/companies/`, plus company `suspend/` and `reactivate/` actions.
- Company onboarding: `companies/register/`.
- Company admin: `company/profile/`, `company/settings/`, `company/customers/`, and routers for `services/`, `professionals/`, `work-schedules/`, and `appointments/` (including `confirm/` and `cancel/`).
- Public: `public/platform/`, paginated active-company search at `public/companies/`, `public/companies/{slug}/`, privacy-preserving view tracking at `public/companies/{slug}/view/`, `services/`, `professionals/`, `availability/`, and appointment create/cancel/reschedule routes.
- Customer: `customers/register/`, `customers/profile/me/` (including avatar), `customers/appointments/` with cancel/reschedule actions, and the account-security routes below.

### Customer account security

Changing an e-mail address or password requires an authenticated customer and never accepts a user id from the browser. Password changes use `customers/security/password/request/`, `customers/security/password/verify/`, then the compatible final route `customers/password/change/`. E-mail changes use the current-address `request/` and `verify/` routes followed by the new-address `request/` and `verify/` routes under `customers/security/email-change/`.

The backend creates six-digit codes with Python's cryptographic RNG and stores only Django password hashes. Codes expire after 10 minutes, allow five wrong attempts, have a 60-second resend cooldown, are single-use and are bound to one of `PASSWORD_CHANGE`, `EMAIL_CHANGE_CURRENT`, or `EMAIL_CHANGE_NEW`. Successful verification creates a separate random, single-use authorization valid for 10 minutes; only its SHA-256 digest is stored.

Security endpoint limits are persisted in PostgreSQL and therefore work across application workers: code requests and sensitive final actions allow five attempts per 10-minute user/IP/purpose window, while verification endpoints also have a 15-attempt endpoint window and each challenge still stops after five wrong codes. Old fixed windows are removed opportunistically. These limits supplement, rather than replace, reverse-proxy/CDN controls.

After a password change, `auth_version` invalidates every existing access JWT immediately and all outstanding refresh JWTs are blacklisted. The customer must sign in again.

### Transactional e-mail

All account-security e-mail is sent server-side through the shared Resend service. Configure:

```dotenv
EMAIL_PROVIDER=resend
RESEND_API_KEY=replace-with-a-resend-api-key
DEFAULT_FROM_EMAIL="OpticNoteBook <no-reply@your-verified-domain.example>"
```

The sender domain must be verified in Resend. Never expose these values through `VITE_*` variables. Production configuration fails closed if the provider, API key, or sender is missing. A failed OTP delivery returns a generic service error and leaves no valid challenge. Security notifications are best-effort after the database transaction and failures are recorded without addresses, codes, tokens, or passwords.

Registration authorization keys and anonymous appointment-management tokens are returned in full only when issued. Only SHA-256 digests of the high-entropy random secrets are stored. Passwords use Django's password system with Argon2 preferred. JWT refresh tokens rotate, the previous token is blacklisted, and refresh/logout are protected by Django CSRF.

Company search accepts `search` (or the compatible `q` alias), `state`, `city`, `niche`, `business_type`, `service`, `ordering=name|-name`, `page`, and `page_size`. Filtering happens in PostgreSQL and public responses omit owner and administrative data. Company views are aggregated daily; only a SHA-256 digest of the browser-generated anonymous identifier is stored, and repeated views inside a 30-minute window are ignored.

Turnstile server validation can be required through `TURNSTILE_REQUIRED`; production fails closed if its secret is missing. Current scoped limits are login 5/minute plus identity/IP 20/hour, refresh 20/minute, company registration 3/hour, customer registration 5/10 minutes, anonymous booking 10/10 minutes, anonymous cancel/reschedule 10/10 minutes, availability 60/minute and light public reads 120/minute. Authenticated users also receive a 1000/hour general limit.

These Django/DRF controls are application-level safeguards, not complete brute-force or denial-of-service protection. Production still requires rate limiting, request-body limits, TLS and security headers at the reverse proxy/CDN/edge. Configure a Content Security Policy for the frontend that includes the official Turnstile origins and the actual API origin.

Before deploying account-security changes, run:

```powershell
python manage.py check
python manage.py makemigrations --check
python manage.py test
```
