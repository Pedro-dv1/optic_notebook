from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from django.db.models import Count, Exists, OuterRef, Q
from companies.models import Company
from companies.serializers import PublicCompanySearchSerializer
from bookings.models import Appointment
from .models import CompanyFavorite, FavoriteSuggestionDismissal
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
    CompanyFavoriteSerializer,
    FavoriteSuggestionDismissSerializer,
)


class CompanyFavoriteViewSet(viewsets.GenericViewSet):
    permission_classes = (IsCustomer,)
    serializer_class = CompanyFavoriteSerializer

    def get_queryset(self):
        return CompanyFavorite.objects.filter(customer=self.request.user).select_related("company").prefetch_related("company__units")

    def list(self, request):
        queryset = self.get_queryset().filter(company__status=Company.Status.ACTIVE)
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    def create(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        favorite, created = CompanyFavorite.objects.get_or_create(customer=request.user, company=serializer.validated_data["company"])
        return Response(self.get_serializer(favorite).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def destroy(self, request, pk=None):
        self.get_object().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=("get",))
    def status(self, request):
        from rest_framework import serializers
        if "companies" in request.query_params:
            ids = serializers.ListField(child=serializers.UUIDField(), max_length=48).run_validation(request.query_params["companies"].split(","))
            favorites = self.get_queryset().filter(company_id__in=ids).values_list("company_id", "id")
            return Response({str(company): str(pk) for company, pk in favorites})
        company_id = serializers.UUIDField().run_validation(request.query_params.get("company"))
        favorite = self.get_queryset().filter(company_id=company_id).first()
        return Response({"id": favorite.id if favorite else None})

    @action(detail=False, methods=("get",))
    def suggestions(self, request):
        # ASVS 8.2.2: count only this customer's real confirmed bookings, never snapshots matching an e-mail.
        companies = Company.objects.filter(
            Q(appointments__outcome__isnull=True) | Q(appointments__outcome=Appointment.Outcome.COMPLETED),
            status=Company.Status.ACTIVE,
            appointments__customer=request.user,
            appointments__status=Appointment.Status.CONFIRMED,
        ).annotate(
            already_favorite=Exists(CompanyFavorite.objects.filter(customer=request.user, company=OuterRef("pk"))),
            dismissed=Exists(FavoriteSuggestionDismissal.objects.filter(customer=request.user, company=OuterRef("pk"))),
            valid_bookings=Count("appointments"),
        ).filter(already_favorite=False, dismissed=False, valid_bookings__gte=3).prefetch_related("units").order_by("name", "id")[:3]
        return Response(PublicCompanySearchSerializer(companies, many=True, context={"request": request}).data)

    @action(detail=False, methods=("post",), url_path="dismiss-suggestion", serializer_class=FavoriteSuggestionDismissSerializer)
    def dismiss_suggestion(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        FavoriteSuggestionDismissal.objects.get_or_create(customer=request.user, company=serializer.validated_data["company"])
        return Response(status=status.HTTP_204_NO_CONTENT)

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
