from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler


class SecurityFlowError(APIException):
    def __init__(self, code, message, *, status_code=400, wait=None):
        self.status_code = status_code
        self.wait = wait
        super().__init__({"code": code, "message": message})


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        response.data = {"errors": response.data}
        if getattr(exc, "wait", None) is not None:
            response.headers["Retry-After"] = str(max(1, int(exc.wait)))
    return response
