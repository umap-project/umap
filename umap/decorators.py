from functools import wraps

from django.urls import reverse_lazy
from django.shortcuts import get_object_or_404
from django.http import HttpResponseForbidden
from django.conf import settings

from .views import simple_json_response
from .models import Map


LOGIN_URL = getattr(settings, "LOGIN_URL", "login")
LOGIN_URL = (reverse_lazy(LOGIN_URL) if not LOGIN_URL.startswith("/")
             else LOGIN_URL)


def login_required_if_not_anonymous_allowed(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if (not getattr(settings, "UMAP_ALLOW_ANONYMOUS", False)
                and not request.user.is_authenticated):
            return simple_json_response(login_required=str(LOGIN_URL))
        return view_func(request, *args, **kwargs)
    return wrapper


def map_permissions_check(view_func):
    """
    Used for URLs dealing with the map.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        map_inst = get_object_or_404(Map, pk=kwargs['map_id'])
        user = request.user
        kwargs['map_inst'] = map_inst  # Avoid rerequesting the map in the view
        if map_inst.edit_status >= map_inst.EDITORS:
            can_edit = map_inst.can_edit(user=user, request=request)
            if not can_edit:
                if map_inst.owner and not user.is_authenticated:
                    return simple_json_response(login_required=str(LOGIN_URL))
                return HttpResponseForbidden()
        return view_func(request, *args, **kwargs)
    return wrapper


def jsonize_view(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        response = view_func(request, *args, **kwargs)
        response_kwargs = {}
        if hasattr(response, 'rendered_content'):
            response_kwargs['html'] = response.rendered_content
        if response.has_header('location'):
            response_kwargs['redirect'] = response['location']
        return simple_json_response(**response_kwargs)
    return wrapper
