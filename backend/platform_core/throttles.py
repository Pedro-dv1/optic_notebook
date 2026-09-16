import hashlib

from rest_framework.throttling import ScopedRateThrottle, SimpleRateThrottle


class WindowScopedRateThrottle(ScopedRateThrottle):
    """Scoped throttle with explicit second-based windows such as 10/600s."""

    def parse_rate(self, rate):
        if rate and rate.endswith("s") and "/" in rate:
            requests, seconds = rate[:-1].split("/", 1)
            if seconds.isdigit():
                return int(requests), int(seconds)
        return super().parse_rate(rate)


class LoginIdentityThrottle(SimpleRateThrottle):
    scope = "login_identity"

    def get_cache_key(self, request, view):
        email = str(request.data.get("email", "")).strip().lower()
        if not email:
            return None
        identity = f"{self.get_ident(request)}:{email}".encode("utf-8")
        digest = hashlib.sha256(identity).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": digest}

    def parse_rate(self, rate):
        if rate and rate.endswith("s") and "/" in rate:
            requests, seconds = rate[:-1].split("/", 1)
            if seconds.isdigit():
                return int(requests), int(seconds)
        return super().parse_rate(rate)
