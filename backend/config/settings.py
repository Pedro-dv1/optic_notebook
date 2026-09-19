import os
from datetime import timedelta
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env", override=False)


def required(name):
    value = os.getenv(name)
    if value is None or not value.strip():
        raise ImproperlyConfigured(f"Required environment variable {name} is missing or empty.")
    return value.strip()


def boolean(name, default=None):
    value = os.getenv(name)
    if value is None:
        if default is None:
            raise ImproperlyConfigured(f"Required environment variable {name} is missing.")
        return default
    normalized = value.strip().lower()
    if normalized not in {"true", "false", "1", "0"}:
        raise ImproperlyConfigured(f"Environment variable {name} must be true or false.")
    return normalized in {"true", "1"}


def positive_integer(name):
    try:
        value = int(required(name))
    except ValueError as exc:
        raise ImproperlyConfigured(f"Environment variable {name} must be an integer.") from exc
    if value <= 0:
        raise ImproperlyConfigured(f"Environment variable {name} must be positive.")
    return value


def choice(name, default, allowed):
    value = os.getenv(name, default).strip()
    if value not in allowed:
        raise ImproperlyConfigured(f"Environment variable {name} must be one of: {', '.join(sorted(allowed))}.")
    return value


def csv_values(name, required_value=False):
    raw = os.getenv(name, "")
    values = [item.strip() for item in raw.split(",") if item.strip()]
    if required_value and not values:
        raise ImproperlyConfigured(f"Environment variable {name} must contain at least one value.")
    return values


ENVIRONMENT = required("ENVIRONMENT").lower()
DEBUG = boolean("DEBUG")
IS_PRODUCTION = ENVIRONMENT == "production"

if IS_PRODUCTION and DEBUG:
    raise ImproperlyConfigured("DEBUG must be false when ENVIRONMENT=production.")

SECRET_KEY = required("DJANGO_SECRET_KEY")
BACKEND_URL = required("BACKEND_URL")
FRONTEND_URL = required("FRONTEND_URL")
ALLOWED_HOSTS = csv_values("ALLOWED_HOSTS", required_value=True)
CORS_ALLOWED_ORIGINS = csv_values("CORS_ALLOWED_ORIGINS", required_value=IS_PRODUCTION)
CSRF_TRUSTED_ORIGINS = csv_values("CSRF_TRUSTED_ORIGINS", required_value=IS_PRODUCTION)
CORS_ALLOW_CREDENTIALS = True

if IS_PRODUCTION and ("*" in ALLOWED_HOSTS or "*" in CORS_ALLOWED_ORIGINS):
    raise ImproperlyConfigured("Wildcard hosts or CORS origins are not allowed in production.")
if IS_PRODUCTION and (not BACKEND_URL.startswith("https://") or not FRONTEND_URL.startswith("https://")):
    raise ImproperlyConfigured("Production backend and frontend URLs must use HTTPS.")

EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "").strip()
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "webmaster@localhost").strip()
EMAIL_TIMEOUT_SECONDS = 5
PLATFORM_NAME = os.getenv("PLATFORM_NAME", "OpticNoteBook").strip()
PLATFORM_SUPPORT_EMAIL = os.getenv("PLATFORM_SUPPORT_EMAIL", "").strip()
PLATFORM_ADMIN_EMAIL = os.getenv("PLATFORM_ADMIN_EMAIL", "").strip()
TURNSTILE_REQUIRED = boolean("TURNSTILE_REQUIRED", default=IS_PRODUCTION)
TURNSTILE_SECRET_KEY = os.getenv("TURNSTILE_SECRET_KEY", "").strip()
TURNSTILE_EXPECTED_HOSTNAMES = csv_values("TURNSTILE_EXPECTED_HOSTNAMES")
TURNSTILE_TIMEOUT_SECONDS = 5
if IS_PRODUCTION and TURNSTILE_REQUIRED and not TURNSTILE_SECRET_KEY:
    raise ImproperlyConfigured("TURNSTILE_SECRET_KEY is required when Turnstile is enabled in production.")
if IS_PRODUCTION and TURNSTILE_REQUIRED and not TURNSTILE_EXPECTED_HOSTNAMES:
    raise ImproperlyConfigured("TURNSTILE_EXPECTED_HOSTNAMES is required when Turnstile is enabled in production.")
if EMAIL_PROVIDER not in {"", "resend"}:
    raise ImproperlyConfigured("EMAIL_PROVIDER must be empty or resend.")
if IS_PRODUCTION and (EMAIL_PROVIDER != "resend" or not RESEND_API_KEY or not DEFAULT_FROM_EMAIL):
    raise ImproperlyConfigured("Production account verification requires Resend email configuration.")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "accounts",
    "platform_core",
    "companies",
    "customers",
    "services",
    "professionals",
    "bookings",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": required("DB_NAME"),
        "USER": required("DB_USER"),
        "PASSWORD": required("DB_PASSWORD"),
        "HOST": required("DB_HOST"),
        "PORT": required("DB_PORT"),
        "CONN_MAX_AGE": 60 if IS_PRODUCTION else 0,
        "CONN_HEALTH_CHECKS": IS_PRODUCTION,
    }
}

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
]

LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

SECURE_SSL_REDIRECT = boolean("SECURE_SSL_REDIRECT") if IS_PRODUCTION else False
SESSION_COOKIE_SECURE = boolean("SESSION_COOKIE_SECURE") if IS_PRODUCTION else False
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 60 * 60 * 24 * 7
CSRF_COOKIE_SECURE = boolean("CSRF_COOKIE_SECURE") if IS_PRODUCTION else False
CSRF_COOKIE_HTTPONLY = False  # The SPA reads this non-secret token to send X-CSRFToken.
CSRF_COOKIE_SAMESITE = "Lax"
REFRESH_COOKIE_NAME = "obn_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth/"
REFRESH_COOKIE_SAMESITE = choice("REFRESH_COOKIE_SAMESITE", "Lax", {"Lax", "Strict", "None"})
REFRESH_COOKIE_SECURE = IS_PRODUCTION
if REFRESH_COOKIE_SAMESITE == "None" and not REFRESH_COOKIE_SECURE:
    raise ImproperlyConfigured("SameSite=None refresh cookies require Secure=True.")
if IS_PRODUCTION and not all((SECURE_SSL_REDIRECT, SESSION_COOKIE_SECURE, CSRF_COOKIE_SECURE)):
    raise ImproperlyConfigured("Production requires HTTPS redirect and secure session/CSRF cookies.")
SECURE_HSTS_SECONDS = 31_536_000 if IS_PRODUCTION else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = IS_PRODUCTION
SECURE_HSTS_PRELOAD = IS_PRODUCTION
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "accounts.authentication.VersionedJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_RENDERER_CLASSES": ("rest_framework.renderers.JSONRenderer",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_CLASSES": (
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ),
    "DEFAULT_THROTTLE_RATES": {
        "anon": "120/hour",
        "user": "1000/hour",
        "login": "5/minute",
        "login_identity": "20/3600s",
        "refresh": "20/minute",
        "company_registration": "3/hour",
        "customer_registration": "5/600s",
        "booking": "10/600s",
        "public_change": "10/600s",
        "availability": "60/minute",
        "public_read": "120/minute",
    },
    "EXCEPTION_HANDLER": "platform_core.exceptions.api_exception_handler",
}

ACCOUNT_OTP_TTL = timedelta(minutes=10)
ACCOUNT_AUTHORIZATION_TTL = timedelta(minutes=10)
ACCOUNT_OTP_RESEND_SECONDS = 60
ACCOUNT_OTP_MAX_ATTEMPTS = 5

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=positive_integer("JWT_ACCESS_MINUTES")),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=positive_integer("JWT_REFRESH_DAYS")),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": False,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

DATA_UPLOAD_MAX_MEMORY_SIZE = 3_145_728
DATA_UPLOAD_MAX_NUMBER_FIELDS = 100

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"standard": {"format": "{asctime} {levelname} {name} {message}", "style": "{"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "standard"}},
    "loggers": {
        "optic_notebook.security": {"handlers": ["console"], "level": "INFO", "propagate": False},
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}
