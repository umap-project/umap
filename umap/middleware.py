from django.conf import settings
from django.contrib import messages
from django.contrib.auth import BACKEND_SESSION_KEY
from django.core.exceptions import MiddlewareNotUsed
from django.http import (
    HttpResponseForbidden,
    HttpResponseRedirect,
)
from django.urls import reverse
from django.utils.translation import gettext as _


def readonly_middleware(get_response):
    if not settings.UMAP_READONLY:
        raise MiddlewareNotUsed

    def middleware(request):
        if request.method not in ["GET", "OPTIONS", "HEAD"]:
            return HttpResponseForbidden(_("Site is readonly for maintenance"))

        return get_response(request)

    return middleware


def deprecated_auth_backend(get_response):
    def middleware(request):
        backend = request.session.get(BACKEND_SESSION_KEY)
        if backend in settings.DEPRECATED_AUTHENTICATION_BACKENDS:
            name = backend.split(".")[-1]
            messages.error(
                request,
                _(
                    "Using “%(name)s” to authenticate is deprecated and will be "
                    "removed soon. "
                    "Please configure another provider below before losing access "
                    "to your account and maps. Then, please logout and login "
                    "again with the new provider."
                )
                % {"name": name},
            )
            if "/map/" in request.path:
                return HttpResponseRedirect(reverse("user_profile"))

        return get_response(request)

    return middleware
