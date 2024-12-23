from functools import wraps

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.http import HttpResponseForbidden
from django.shortcuts import get_object_or_404
from django.urls import reverse_lazy
from django.utils.translation import gettext as _

from .models import Map, Team
from .views import simple_json_response

LOGIN_URL = getattr(settings, "LOGIN_URL", "login")
LOGIN_URL = reverse_lazy(LOGIN_URL) if not LOGIN_URL.startswith("/") else LOGIN_URL


def login_required_if_not_anonymous_allowed(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if (
            not getattr(settings, "UMAP_ALLOW_ANONYMOUS", False)
            and not request.user.is_authenticated
        ):
            return simple_json_response(login_required=str(LOGIN_URL))
        return view_func(request, *args, **kwargs)

    return wrapper


def can_edit_map(view_func):
    """
    Used for URLs dealing with editing the map.
    """

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        map_inst = get_object_or_404(Map, pk=kwargs["map_id"])
        kwargs["map_inst"] = map_inst  # Avoid rerequesting the map in the view
        if map_inst.edit_status >= map_inst.COLLABORATORS:
            can_edit = map_inst.can_edit(request=request)
            if not can_edit:
                if map_inst.owner and not request.user.is_authenticated:
                    return simple_json_response(login_required=str(LOGIN_URL))
                return HttpResponseForbidden()
        return view_func(request, *args, **kwargs)

    return wrapper


def can_view_map(view_func):
    """
    Used for URLs dealing with viewing the map.
    """

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        map_inst = get_object_or_404(Map, pk=kwargs["map_id"])
        kwargs["map_inst"] = map_inst  # Avoid rerequesting the map in the view
        if not map_inst.can_view(request):
            raise PermissionDenied(_("This map is not publicly available"))
        return view_func(request, *args, **kwargs)

    return wrapper


def team_members_only(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        team = get_object_or_404(Team, pk=kwargs["pk"])
        if not request.user.is_authenticated or team not in request.user.teams.all():
            return HttpResponseForbidden()
        return view_func(request, *args, **kwargs)

    return wrapper
