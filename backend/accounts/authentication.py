from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class VersionedJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        # ASVS V7.4: credential changes revoke existing access tokens without breaking pre-migration tokens.
        if validated_token.get("auth_version", 0) != user.auth_version:
            raise AuthenticationFailed("A sessão é inválida ou expirou.")
        return user
