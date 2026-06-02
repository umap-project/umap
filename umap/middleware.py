from django.conf import settings
from django.contrib import messages
from django.contrib.auth import BACKEND_SESSION_KEY
from django.contrib.gis.geos.prototypes import io as geos_io
from django.core.exceptions import MiddlewareNotUsed
from django.http import (
    HttpResponseForbidden,
    HttpResponseRedirect,
)
from django.urls import reverse
from django.utils.translation import gettext as _


def geos_thread_cleanup(get_response):
    """Work around Django #29878.

    Under ASGI, Django runs each sync request in a worker thread that is torn
    down afterwards. GEOS keeps thread-local WKB/WKT readers/writers; when the
    thread is destroyed, their destructors re-create a GEOSContextHandle while
    Python is clearing thread-local storage, and that handle is never freed —
    one leaked handle per request. Clearing the thread-local here, while the
    thread is still alive, lets the handles be released normally and stops the
    leak. Any geometry (e.g. Map.center) touched during the request is enough
    to trigger it, so this wraps every request.
    """

    def middleware(request):
        try:
            return get_response(request)
        finally:
            geos_io.thread_context.__dict__.clear()

    return middleware


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
