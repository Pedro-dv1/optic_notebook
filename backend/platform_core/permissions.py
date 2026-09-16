from rest_framework.permissions import BasePermission


def company_for_user(user):
    if not user or not user.is_authenticated:
        return None
    from companies.models import Company

    return Company.objects.filter(owner=user).first()


class IsSuperuser(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class IsCompanyAdmin(BasePermission):
    message = "É necessária uma conta de administrador de empresa."

    def has_permission(self, request, view):
        return company_for_user(request.user) is not None


class IsActiveCompanyAdmin(BasePermission):
    message = "Esta conta está suspensa."

    def has_permission(self, request, view):
        company = company_for_user(request.user)
        return bool(company and company.status == company.Status.ACTIVE)


class IsCustomer(BasePermission):
    message = "É necessária uma conta de cliente."

    def has_permission(self, request, view):
        user = request.user
        # ASVS V8.2/V8.4: enforce the account role server-side, independently of hidden UI routes.
        return bool(
            user
            and user.is_authenticated
            and not user.is_superuser
            and company_for_user(user) is None
        )
