from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect

from accounts.account_security import (
    confirm_new_email,
    confirm_password_change,
    request_new_email_otp,
    request_otp,
    verify_identity_otp,
)
from accounts.models import AccountVerificationChallenge
from platform_core.throttles import WindowScopedRateThrottle
from platform_core.permissions import IsCustomer

from .serializers import (
    AccountActionRequestSerializer,
    CustomerPasswordChangeSerializer,
    CustomerProfileSerializer,
    CustomerRegistrationSerializer,
    NewEmailRequestSerializer,
    NewEmailVerificationSerializer,
    OtpVerificationSerializer,
)

@method_decorator(csrf_protect, name="dispatch")
class CustomerRegistrationView(generics.CreateAPIView):
    permission_classes = (AllowAny,)
    serializer_class = CustomerRegistrationSerializer
    throttle_classes = (WindowScopedRateThrottle,)
    throttle_scope = "customer_registration"


class CustomerProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = (IsCustomer,)
    serializer_class = CustomerProfileSerializer

    def get_object(self):
        return self.request.user


class CustomerPasswordChangeView(generics.GenericAPIView):
    permission_classes = (IsCustomer,)
    serializer_class = CustomerPasswordChangeSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        confirm_password_change(
            request.user,
            request,
            serializer.validated_data["authorization_token"],
            serializer.validated_data["new_password"],
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class PasswordOtpRequestView(generics.GenericAPIView):
    permission_classes = (IsCustomer,)
    serializer_class = AccountActionRequestSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = request_otp(
            request.user,
            request,
            AccountVerificationChallenge.Purpose.PASSWORD_CHANGE,
            request.user.email,
        )
        return Response(data, status=status.HTTP_201_CREATED)


class PasswordOtpVerifyView(generics.GenericAPIView):
    permission_classes = (IsCustomer,)
    serializer_class = OtpVerificationSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = verify_identity_otp(
            request.user,
            request,
            AccountVerificationChallenge.Purpose.PASSWORD_CHANGE,
            serializer.validated_data["challenge_id"],
            serializer.validated_data["code"],
        )
        return Response(data)


class EmailChangeCurrentRequestView(generics.GenericAPIView):
    permission_classes = (IsCustomer,)
    serializer_class = AccountActionRequestSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = request_otp(
            request.user,
            request,
            AccountVerificationChallenge.Purpose.EMAIL_CHANGE_CURRENT,
            request.user.email,
        )
        return Response(data, status=status.HTTP_201_CREATED)


class EmailChangeCurrentVerifyView(generics.GenericAPIView):
    permission_classes = (IsCustomer,)
    serializer_class = OtpVerificationSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = verify_identity_otp(
            request.user,
            request,
            AccountVerificationChallenge.Purpose.EMAIL_CHANGE_CURRENT,
            serializer.validated_data["challenge_id"],
            serializer.validated_data["code"],
        )
        return Response(data)


class EmailChangeNewRequestView(generics.GenericAPIView):
    permission_classes = (IsCustomer,)
    serializer_class = NewEmailRequestSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = request_new_email_otp(
            request.user,
            request,
            serializer.validated_data["authorization_token"],
            serializer.validated_data["new_email"],
        )
        return Response(data, status=status.HTTP_201_CREATED)


class EmailChangeNewVerifyView(generics.GenericAPIView):
    permission_classes = (IsCustomer,)
    serializer_class = NewEmailVerificationSerializer

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        confirm_new_email(
            request.user,
            request,
            serializer.validated_data["authorization_token"],
            serializer.validated_data["challenge_id"],
            serializer.validated_data["code"],
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
