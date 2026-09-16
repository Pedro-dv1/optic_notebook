import logging

from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from platform_core.throttles import LoginIdentityThrottle, WindowScopedRateThrottle

from .serializers import EmailTokenObtainPairSerializer, LogoutSerializer, UserSerializer

security_logger = logging.getLogger("optic_notebook.security")


def _set_refresh_cookie(response, token):
    response.set_cookie(
        settings.REFRESH_COOKIE_NAME,
        token,
        max_age=int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.REFRESH_COOKIE_SECURE,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
        path=settings.REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response):
    response.delete_cookie(
        settings.REFRESH_COOKIE_NAME,
        path=settings.REFRESH_COOKIE_PATH,
        samesite=settings.REFRESH_COOKIE_SAMESITE,
    )


@method_decorator(csrf_protect, name="dispatch")
class LoginView(TokenObtainPairView):
    permission_classes = (AllowAny,)
    serializer_class = EmailTokenObtainPairSerializer
    throttle_classes = (WindowScopedRateThrottle, LoginIdentityThrottle)
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        try:
            response = super().post(request, *args, **kwargs)
        except AuthenticationFailed:
            security_logger.warning("authentication_failed")
            raise
        if response.status_code == status.HTTP_200_OK:
            security_logger.info("authentication_succeeded user_id=%s", response.data["user"]["id"])
            refresh = response.data.pop("refresh")
            _set_refresh_cookie(response, refresh)
        return response


@method_decorator(csrf_protect, name="dispatch")
class RefreshView(TokenRefreshView):
    permission_classes = (AllowAny,)
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "refresh"

    def post(self, request, *args, **kwargs):
        refresh = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not refresh:
            return Response({"errors": {"detail": "A sessão não está disponível."}}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = self.get_serializer(data={"refresh": refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            response = Response(
                {"errors": {"detail": "A sessão é inválida ou expirou."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            _clear_refresh_cookie(response)
            return response
        data = dict(serializer.validated_data)
        rotated_refresh = data.pop("refresh", None)
        response = Response(data, status=status.HTTP_200_OK)
        if rotated_refresh:
            _set_refresh_cookie(response, rotated_refresh)
        return response


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(generics.GenericAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = LogoutSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        refresh = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not refresh:
            response = Response(status=status.HTTP_204_NO_CONTENT)
            _clear_refresh_cookie(response)
            return response
        try:
            token = RefreshToken(refresh)
            if str(token["user_id"]) != str(request.user.id):
                raise TokenError("Token does not belong to the authenticated user.")
            token.blacklist()
        except TokenError:
            response = Response({"errors": {"detail": ["A sessão é inválida ou expirou."]}}, status=status.HTTP_400_BAD_REQUEST)
            _clear_refresh_cookie(response)
            return response
        security_logger.info("logout_succeeded user_id=%s", request.user.id)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_refresh_cookie(response)
        return response


class MeView(generics.RetrieveAPIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
