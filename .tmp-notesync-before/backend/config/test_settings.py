from .settings import *  # noqa: F403

# Test fixtures create many users; production continues to use Argon2.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
