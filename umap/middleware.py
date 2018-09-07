from django.conf import settings
from django.core.exceptions import MiddlewareNotUsed
from django.http import HttpResponseForbidden


def readonly_middleware(get_response):

    if not settings.UMAP_READONLY:
        raise MiddlewareNotUsed

    def middleware(request):
        if request.method not in ['GET', 'OPTIONS']:
            return HttpResponseForbidden('Site is readonly')

        return get_response(request)

    return middleware
