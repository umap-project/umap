import io
import json
import mimetypes
import os
import re
import socket
import zipfile
from datetime import datetime, timedelta
from http.client import InvalidURL
from io import BytesIO
from pathlib import Path
from smtplib import SMTPException
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus, urlparse
from urllib.request import Request, build_opener

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth import logout as do_logout
from django.contrib.gis.measure import D
from django.contrib.postgres.search import SearchQuery, SearchVector
from django.contrib.staticfiles.storage import staticfiles_storage
from django.core.exceptions import PermissionDenied
from django.core.mail import send_mail
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.core.signing import BadSignature, Signer, TimestampSigner
from django.core.validators import URLValidator, ValidationError
from django.http import (
    Http404,
    HttpResponse,
    HttpResponseBadRequest,
    HttpResponseForbidden,
    HttpResponsePermanentRedirect,
    HttpResponseRedirect,
    HttpResponseServerError,
)
from django.middleware.gzip import re_accepts_gzip
from django.shortcuts import get_object_or_404
from django.urls import resolve, reverse, reverse_lazy
from django.utils import translation
from django.utils.encoding import smart_bytes
from django.utils.timezone import make_aware
from django.utils.translation import gettext as _
from django.views.decorators.cache import cache_control
from django.views.decorators.http import require_GET
from django.views.generic import DetailView, TemplateView, View
from django.views.generic.base import RedirectView
from django.views.generic.detail import BaseDetailView
from django.views.generic.edit import CreateView, DeleteView, FormView, UpdateView
from django.views.generic.list import ListView

from . import VERSION
from .forms import (
    DEFAULT_CENTER,
    DEFAULT_LATITUDE,
    DEFAULT_LONGITUDE,
    AnonymousDataLayerPermissionsForm,
    AnonymousMapPermissionsForm,
    DataLayerForm,
    DataLayerPermissionsForm,
    FlatErrorList,
    MapSettingsForm,
    SendLinkForm,
    TeamForm,
    UpdateMapPermissionsForm,
    UserProfileForm,
)
from .models import DataLayer, Licence, Map, Pictogram, Star, Team, TileLayer
from .utils import (
    ConflictError,
    _urls_for_js,
    gzip_file,
    is_ajax,
    json_dumps,
    merge_features,
)

User = get_user_model()


PRIVATE_IP = re.compile(
    r"((^127\.)|(^10\.)"
    r"|(^172\.1[6-9]\.)"
    r"|(^172\.2[0-9]\.)"
    r"|(^172\.3[0-1]\.)"
    r"|(^192\.168\.))"
)
ANONYMOUS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # One month


class PaginatorMixin:
    per_page = 5

    def paginate(self, qs, per_page=None):
        paginator = Paginator(qs, per_page or self.per_page)
        page = self.request.GET.get("p")
        try:
            qs = paginator.page(page)
        except PageNotAnInteger:
            # If page is not an integer, deliver first page.
            qs = paginator.page(1)
        except EmptyPage:
            # If page is out of range (e.g. 9999), deliver last page of
            # results.
            qs = paginator.page(paginator.num_pages)
        return qs

    def get_context_data(self, **kwargs):
        kwargs.update({"is_ajax": is_ajax(self.request)})
        return super().get_context_data(**kwargs)

    def get_template_names(self):
        """
        Dispatch template according to the kind of request: ajax or normal.
        """
        if is_ajax(self.request):
            return [self.list_template_name]
        return super().get_template_names()

    def get(self, *args, **kwargs):
        response = super().get(*args, **kwargs)
        if is_ajax(self.request):
            return simple_json_response(html=response.rendered_content)
        return response


class PublicMapsMixin(object):
    def get_public_maps(self):
        qs = Map.public
        if (
            settings.UMAP_EXCLUDE_DEFAULT_MAPS
            and "spatialite" not in settings.DATABASES["default"]["ENGINE"]
        ):
            # Unsupported query type for sqlite.
            qs = qs.filter(center__distance_gt=(DEFAULT_CENTER, D(km=1)))
        maps = qs.order_by("-modified_at")
        return maps

    def get_highlighted_maps(self):
        staff = User.objects.filter(is_staff=True)
        stars = Star.objects.filter(by__in=staff).values("map")
        qs = Map.public.filter(pk__in=stars)
        maps = qs.order_by("-modified_at")
        return maps


class Home(PaginatorMixin, TemplateView, PublicMapsMixin):
    template_name = "umap/home.html"
    list_template_name = "umap/map_list.html"

    def get_context_data(self, **kwargs):
        if settings.UMAP_HOME_FEED is None:
            maps = []
        elif settings.UMAP_HOME_FEED == "highlighted":
            maps = self.get_highlighted_maps()
        else:
            maps = self.get_public_maps()
        maps = self.paginate(maps, settings.UMAP_MAPS_PER_PAGE)

        demo_map = None
        if hasattr(settings, "UMAP_DEMO_PK"):
            try:
                demo_map = Map.public.get(pk=settings.UMAP_DEMO_PK)
            except Map.DoesNotExist:
                pass

        showcase_map = None
        if hasattr(settings, "UMAP_SHOWCASE_PK"):
            try:
                showcase_map = Map.public.get(pk=settings.UMAP_SHOWCASE_PK)
            except Map.DoesNotExist:
                pass

        return {
            "maps": maps,
            "demo_map": demo_map,
            "showcase_map": showcase_map,
        }


home = Home.as_view()


class About(Home):
    template_name = "umap/about.html"


about = About.as_view()


class TeamNew(CreateView):
    model = Team
    fields = ["name", "description"]
    success_url = reverse_lazy("user_teams")

    def form_valid(self, form):
        response = super().form_valid(form)
        self.request.user.teams.add(self.object)
        self.request.user.save()
        return response


class TeamUpdate(UpdateView):
    model = Team
    form_class = TeamForm
    success_url = reverse_lazy("user_teams")

    def get_initial(self):
        initial = super().get_initial()
        initial["members"] = self.object.users.all()
        return initial

    def form_valid(self, form):
        actual = self.object.users.all()
        wanted = form.cleaned_data["members"]
        for user in wanted:
            if user not in actual:
                user.teams.add(self.object)
                user.save()
        for user in actual:
            if user not in wanted:
                user.teams.remove(self.object)
                user.save()
        return super().form_valid(form)


class TeamDelete(DeleteView):
    model = Team
    success_url = reverse_lazy("user_teams")

    def form_valid(self, form):
        if self.object.users.count() > 1:
            return HttpResponseBadRequest(
                _("Cannot delete a team with more than one member")
            )
        messages.info(
            self.request,
            _("Team “%(name)s” has been deleted") % {"name": self.object.name},
        )
        return super().form_valid(form)


class UserTeams(DetailView):
    model = User
    template_name = "umap/user_teams.html"

    def get_object(self):
        return self.get_queryset().get(pk=self.request.user.pk)

    def get_context_data(self, **kwargs):
        kwargs.update({"teams": self.object.teams.all()})
        return super().get_context_data(**kwargs)


class UserProfile(UpdateView):
    model = User
    form_class = UserProfileForm
    success_url = reverse_lazy("user_profile")

    def get_object(self):
        return self.get_queryset().get(pk=self.request.user.pk)

    def get_context_data(self, **kwargs):
        kwargs.update(
            {"providers": self.object.social_auth.values_list("provider", flat=True)}
        )
        return super().get_context_data(**kwargs)


user_profile = UserProfile.as_view()


class UserMaps(PaginatorMixin, DetailView):
    model = User
    slug_url_kwarg = "identifier"
    slug_field = settings.USER_URL_FIELD
    list_template_name = "umap/map_list.html"
    context_object_name = "current_user"

    def is_owner(self):
        return self.request.user == self.object

    @property
    def per_page(self):
        if self.is_owner():
            return settings.UMAP_MAPS_PER_PAGE_OWNER
        return settings.UMAP_MAPS_PER_PAGE

    def get_maps(self):
        qs = Map.public
        qs = qs.filter(owner=self.object).union(qs.filter(editors=self.object))
        return qs.order_by("-modified_at")

    def get_context_data(self, **kwargs):
        kwargs.update({"maps": self.paginate(self.get_maps(), self.per_page)})
        return super().get_context_data(**kwargs)


user_maps = UserMaps.as_view()


class UserStars(UserMaps):
    template_name = "auth/user_stars.html"

    def get_maps(self):
        stars = Star.objects.filter(by=self.object).values("map")
        qs = Map.public.filter(pk__in=stars)
        return qs.order_by("-modified_at")


user_stars = UserStars.as_view()


class TeamMaps(PaginatorMixin, DetailView):
    model = Team
    list_template_name = "umap/map_list.html"
    context_object_name = "current_team"

    def get_maps(self):
        return Map.public.filter(team=self.object).order_by("-modified_at")

    def get_context_data(self, **kwargs):
        kwargs.update(
            {"maps": self.paginate(self.get_maps(), settings.UMAP_MAPS_PER_PAGE)}
        )
        return super().get_context_data(**kwargs)


class SearchMixin:
    def get_search_queryset(self, **kwargs):
        q = self.request.GET.get("q")
        if q:
            vector = SearchVector("name", config=settings.UMAP_SEARCH_CONFIGURATION)
            query = SearchQuery(
                q, config=settings.UMAP_SEARCH_CONFIGURATION, search_type="websearch"
            )
            return Map.objects.annotate(search=vector).filter(search=query)


class Search(PaginatorMixin, TemplateView, PublicMapsMixin, SearchMixin):
    template_name = "umap/search.html"
    list_template_name = "umap/map_list.html"

    def get_context_data(self, **kwargs):
        qs = self.get_search_queryset()
        qs_count = 0
        results = []
        if qs is not None:
            qs = qs.filter(share_status=Map.PUBLIC).order_by("-modified_at")
            qs_count = qs.count()
            results = self.paginate(qs)
        else:
            results = self.get_public_maps()[: settings.UMAP_MAPS_PER_SEARCH]
        kwargs.update({"maps": results, "count": qs_count})
        return kwargs

    @property
    def per_page(self):
        return settings.UMAP_MAPS_PER_SEARCH


search = Search.as_view()


class UserDashboard(PaginatorMixin, DetailView, SearchMixin):
    model = User
    template_name = "umap/user_dashboard.html"
    list_template_name = "umap/map_table.html"

    def get_object(self):
        return self.get_queryset().get(pk=self.request.user.pk)

    def get_maps(self):
        qs = self.get_search_queryset() or Map.objects.all()
        teams = self.object.teams.all()
        qs = (
            qs.filter(owner=self.object)
            .union(qs.filter(editors=self.object))
            .union(qs.filter(team__in=teams))
        )
        return qs.order_by("-modified_at")

    def get_context_data(self, **kwargs):
        page = self.paginate(self.get_maps(), settings.UMAP_MAPS_PER_PAGE_OWNER)
        kwargs.update({"q": self.request.GET.get("q"), "maps": page})
        return super().get_context_data(**kwargs)


user_dashboard = UserDashboard.as_view()


class UserDownload(DetailView, SearchMixin):
    model = User

    def get_object(self):
        return self.get_queryset().get(pk=self.request.user.pk)

    def get_maps(self):
        qs = Map.objects.filter(id__in=self.request.GET.getlist("map_id"))
        qs = qs.filter(owner=self.object).union(qs.filter(editors=self.object))
        return qs.order_by("-modified_at")

    def render_to_response(self, context, *args, **kwargs):
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
            for map_ in self.get_maps():
                umapjson = map_.generate_umapjson(self.request)
                geojson_file = io.StringIO(json_dumps(umapjson))
                file_name = f"umap_backup_{map_.slug}_{map_.pk}.umap"
                zip_file.writestr(file_name, geojson_file.getvalue())

        response = HttpResponse(zip_buffer.getvalue(), content_type="application/zip")
        response["Content-Disposition"] = (
            'attachment; filename="umap_backup_complete.zip"'
        )
        return response


user_download = UserDownload.as_view()


class MapsShowCase(View):
    def get(self, *args, **kwargs):
        maps = Map.public.filter(center__distance_gt=(DEFAULT_CENTER, D(km=1)))
        maps = maps.order_by("-modified_at")[:2500]

        def make(m):
            description = m.description or ""
            if m.owner:
                description = "{description}\n{by} [[{url}|{name}]]".format(
                    description=description,
                    by=_("by"),
                    url=m.owner.get_url(),
                    name=m.owner,
                )
            description = "{}\n[[{}|{}]]".format(
                description, m.get_absolute_url(), _("View the map")
            )
            geometry = m.settings.get("geometry", json.loads(m.center.geojson))
            return {
                "type": "Feature",
                "geometry": geometry,
                "properties": {"name": m.name, "description": description},
            }

        geojson = {"type": "FeatureCollection", "features": [make(m) for m in maps]}
        return HttpResponse(smart_bytes(json_dumps(geojson)))


showcase = MapsShowCase.as_view()


def validate_url(request):
    assert request.method == "GET"
    url = request.GET.get("url")
    assert url
    try:
        URLValidator(url)
    except ValidationError:
        raise AssertionError()
    assert "HTTP_REFERER" in request.META
    referer = urlparse(request.META.get("HTTP_REFERER"))
    toproxy = urlparse(url)
    local = urlparse(settings.SITE_URL)
    assert toproxy.hostname
    assert referer.hostname == local.hostname
    assert toproxy.hostname != "localhost"
    assert toproxy.netloc != local.netloc
    try:
        # clean this when in python 3.4
        ipaddress = socket.gethostbyname(toproxy.hostname)
    except:
        raise AssertionError()
    assert not PRIVATE_IP.match(ipaddress)
    return url


class AjaxProxy(View):
    def get(self, *args, **kwargs):
        try:
            url = validate_url(self.request)
        except AssertionError:
            return HttpResponseBadRequest()
        try:
            ttl = int(self.request.GET.get("ttl"))
        except (TypeError, ValueError):
            ttl = None
        if getattr(settings, "UMAP_XSENDFILE_HEADER", None):
            response = HttpResponse()
            response[settings.UMAP_XSENDFILE_HEADER] = f"/proxy/{quote_plus(url)}"
            if ttl:
                response["X-Accel-Expires"] = ttl
            return response

        # You should not use this in production (use Nginx or so)
        headers = {"User-Agent": "uMapProxy +http://wiki.openstreetmap.org/wiki/UMap"}
        url = url.replace(" ", "+")
        request = Request(url, headers=headers)
        opener = build_opener()
        try:
            proxied_request = opener.open(request, timeout=10)
        except HTTPError as e:
            return HttpResponse(e.msg, status=e.code, content_type="text/plain")
        except URLError:
            return HttpResponseBadRequest("URL error")
        except InvalidURL:
            return HttpResponseBadRequest("Invalid URL")
        except TimeoutError:
            return HttpResponseBadRequest("Timeout")
        else:
            status_code = proxied_request.code
            content_type = proxied_request.headers.get("Content-Type")
            if not content_type:
                content_type, encoding = mimetypes.guess_type(url)
            content = proxied_request.read()
            # Quick hack to prevent Django from adding a Vary: Cookie header
            self.request.session.accessed = False
            response = HttpResponse(
                content, status=status_code, content_type=content_type
            )
            if ttl:
                response["X-Accel-Expires"] = ttl
            return response


ajax_proxy = AjaxProxy.as_view()


# ############## #
#     Utils      #
# ############## #


def simple_json_response(**kwargs):
    return HttpResponse(json_dumps(kwargs), content_type="application/json")


# ############## #
#      Map       #
# ############## #


class SessionMixin:
    def get_user_data(self):
        data = {}
        user = self.request.user
        if hasattr(self, "object"):
            data["is_owner"] = self.object.is_owner(self.request)
        if user.is_anonymous:
            return data
        return {
            "id": user.pk,
            "name": str(self.request.user),
            "url": reverse("user_dashboard"),
            "teams": [team.get_metadata() for team in user.teams.all()],
            **data,
        }


class FormLessEditMixin:
    http_method_names = [
        "post",
    ]

    def form_invalid(self, form):
        return simple_json_response(errors=form.errors, error=str(form.errors))

    def get_form(self, form_class=None):
        kwargs = self.get_form_kwargs()
        kwargs["error_class"] = FlatErrorList
        return self.get_form_class()(**kwargs)


class MapDetailMixin(SessionMixin):
    model = Map
    pk_url_kwarg = "map_id"

    def set_preconnect(self, properties, context):
        # Try to extract the tilelayer domain, in order to but a preconnect meta.
        url_template = properties.get("tilelayer", {}).get("url_template")
        # Not explicit tilelayer set, take the first of the list, which will be
        # used by frontend too.
        if not url_template:
            tilelayers = properties.get("tilelayers")
            if tilelayers:
                url_template = tilelayers[0].get("url_template")
        if url_template:
            domain = urlparse(url_template).netloc
            # Do not try to preconnect on domains with variables
            if domain and "{" not in domain:
                context["preconnect_domains"] = [f"//{domain}"]

    def get_map_properties(self):
        user = self.request.user
        properties = {
            "urls": _urls_for_js(),
            "tilelayers": TileLayer.get_list(),
            "editMode": self.edit_mode,
            "schema": Map.extra_schema,
            "umap_id": self.get_umap_id(),
            "starred": self.is_starred(),
            "licences": dict((l.name, l.json) for l in Licence.objects.all()),
            "share_statuses": [
                (i, str(label)) for i, label in Map.SHARE_STATUS if i != Map.BLOCKED
            ],
            "umap_version": VERSION,
            "featuresHaveOwner": settings.UMAP_DEFAULT_FEATURES_HAVE_OWNERS,
            "websocketEnabled": settings.WEBSOCKET_ENABLED,
            "websocketURI": settings.WEBSOCKET_FRONT_URI,
            "importers": settings.UMAP_IMPORTERS,
        }
        created = bool(getattr(self, "object", None))
        if (created and self.object.owner) or (not created and not user.is_anonymous):
            map_statuses = Map.EDIT_STATUS
            datalayer_statuses = DataLayer.EDIT_STATUS
        else:
            map_statuses = AnonymousMapPermissionsForm.STATUS
            datalayer_statuses = AnonymousDataLayerPermissionsForm.STATUS
        properties["edit_statuses"] = [(i, str(label)) for i, label in map_statuses]
        properties["datalayer_edit_statuses"] = [
            (i, str(label)) for i, label in datalayer_statuses
        ]
        if self.get_short_url():
            properties["shortUrl"] = self.get_short_url()

        properties["user"] = self.get_user_data()
        return properties

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        properties = self.get_map_properties()
        if settings.USE_I18N:
            lang = settings.LANGUAGE_CODE
            # Check attr in case the middleware is not active
            if hasattr(self.request, "LANGUAGE_CODE"):
                lang = self.request.LANGUAGE_CODE
            properties["lang"] = lang
            locale = translation.to_locale(lang)
            properties["locale"] = locale
            context["locale"] = locale
        geojson = self.get_geojson()
        if "properties" not in geojson:
            geojson["properties"] = {}
        geojson["properties"].update(properties)
        geojson["properties"]["datalayers"] = self.get_datalayers()
        context["map_settings"] = json_dumps(geojson, indent=settings.DEBUG)
        self.set_preconnect(geojson["properties"], context)
        return context

    def get_datalayers(self):
        return []

    @property
    def edit_mode(self):
        return "advanced"

    def get_umap_id(self):
        return None

    def is_starred(self):
        return False

    def get_geojson(self):
        return {
            "geometry": {
                "coordinates": [DEFAULT_LONGITUDE, DEFAULT_LATITUDE],
                "type": "Point",
            },
            "properties": {
                "zoom": getattr(settings, "LEAFLET_ZOOM", 6),
                "datalayers": [],
            },
        }

    def get_short_url(self):
        return None


class PermissionsMixin:
    def get_permissions(self):
        permissions = {}
        permissions["edit_status"] = self.object.edit_status
        permissions["share_status"] = self.object.share_status
        if self.object.owner:
            permissions["owner"] = {
                "id": self.object.owner.pk,
                "name": str(self.object.owner),
                "url": self.object.owner.get_url(),
            }
            permissions["editors"] = [
                {"id": editor.pk, "name": str(editor)}
                for editor in self.object.editors.all()
            ]
        if self.object.team:
            permissions["team"] = self.object.team.get_metadata()
        if not self.object.owner and self.object.is_anonymous_owner(self.request):
            permissions["anonymous_edit_url"] = self.object.get_anonymous_edit_url()
        return permissions


class MapView(MapDetailMixin, PermissionsMixin, DetailView):
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["oembed_absolute_uri"] = self.request.build_absolute_uri(
            reverse("map_oembed")
        )
        context["quoted_absolute_uri"] = quote_plus(
            self.request.build_absolute_uri(self.object.get_absolute_url())
        )
        return context

    def get(self, request, *args, **kwargs):
        self.object = self.get_object()
        canonical = self.get_canonical_url()
        if not request.path == canonical:
            if request.META.get("QUERY_STRING"):
                canonical = "?".join([canonical, request.META["QUERY_STRING"]])
            return HttpResponsePermanentRedirect(canonical)
        response = super(MapView, self).get(request, *args, **kwargs)
        response["Access-Control-Allow-Origin"] = "*"
        return response

    def get_canonical_url(self):
        return self.object.get_absolute_url()

    def get_datalayers(self):
        return [dl.metadata(self.request) for dl in self.object.datalayer_set.all()]

    @property
    def edit_mode(self):
        edit_mode = "disabled"
        if self.object.can_edit(self.request):
            edit_mode = "advanced"
        elif any(d.can_edit(self.request) for d in self.object.datalayer_set.all()):
            edit_mode = "simple"
        return edit_mode

    def get_umap_id(self):
        return self.object.pk

    def get_short_url(self):
        short_url = None
        if getattr(settings, "SHORT_SITE_URL", None):
            short_path = reverse_lazy("map_short_url", kwargs={"pk": self.object.pk})
            short_url = "%s%s" % (settings.SHORT_SITE_URL, short_path)
        return short_url

    def get_geojson(self):
        map_settings = self.object.settings
        if "properties" not in map_settings:
            map_settings["properties"] = {}
        map_settings["properties"]["name"] = self.object.name
        map_settings["properties"]["permissions"] = self.get_permissions()
        author = self.object.get_author()
        if author:
            map_settings["properties"]["author"] = {
                "name": str(author),
                "url": author.get_url(),
            }
        return map_settings

    def is_starred(self):
        user = self.request.user
        if not user.is_authenticated:
            return False
        return Star.objects.filter(by=user, map=self.object).exists()


class MapDownload(DetailView):
    model = Map
    pk_url_kwarg = "map_id"

    def get_canonical_url(self):
        return reverse("map_download", args=(self.object.pk,))

    def render_to_response(self, context, *args, **kwargs):
        umapjson = self.object.generate_umapjson(self.request)
        response = simple_json_response(**umapjson)
        response["Content-Disposition"] = (
            f'attachment; filename="umap_backup_{self.object.slug}.umap"'
        )
        return response


class MapOEmbed(View):
    def get(self, request, *args, **kwargs):
        data = {"type": "rich", "version": "1.0"}
        format_ = request.GET.get("format", "json")
        if format_ != "json":
            response = HttpResponseServerError("Only `json` format is implemented.")
            response.status_code = 501
            return response

        url = request.GET.get("url")
        if not url:
            raise Http404("Missing `url` parameter.")

        parsed_url = urlparse(url)
        netloc = parsed_url.netloc
        allowed_hosts = settings.ALLOWED_HOSTS
        if parsed_url.hostname not in allowed_hosts and allowed_hosts != ["*"]:
            raise Http404("Host not allowed.")

        url_path = parsed_url.path
        lang = translation.get_language_from_path(url_path)
        translation.activate(lang)
        view, args, kwargs = resolve(url_path)
        if "slug" not in kwargs or "map_id" not in kwargs:
            raise Http404("Invalid URL path.")

        map_ = get_object_or_404(Map, id=kwargs["map_id"])

        if map_.share_status != Map.PUBLIC:
            raise PermissionDenied("This map is not public.")

        map_url = map_.get_absolute_url()
        label = _("See full screen")
        height = 300
        data["height"] = height
        width = 800
        data["width"] = width
        # TODISCUSS: do we keep width=100% by default for the iframe?
        html = (
            f'<iframe width="100%" height="{height}px" '
            f'frameborder="0" allowfullscreen allow="geolocation" '
            f'src="//{netloc}{map_url}"></iframe>'
            f'<p><a href="//{netloc}{map_url}">{label}</a></p>'
        )
        data["html"] = html
        response = simple_json_response(**data)
        response["Access-Control-Allow-Origin"] = "*"
        return response


class MapViewGeoJSON(MapView):
    def get_canonical_url(self):
        return reverse("map_geojson", args=(self.object.pk,))

    def render_to_response(self, context, *args, **kwargs):
        return HttpResponse(context["map_settings"], content_type="application/json")


class MapNew(MapDetailMixin, TemplateView):
    template_name = "umap/map_detail.html"


class MapPreview(MapDetailMixin, TemplateView):
    template_name = "umap/map_detail.html"

    def get_map_properties(self):
        properties = super().get_map_properties()
        properties["preview"] = True
        return properties


class MapCreate(FormLessEditMixin, PermissionsMixin, SessionMixin, CreateView):
    model = Map
    form_class = MapSettingsForm

    def form_valid(self, form):
        if self.request.user.is_authenticated:
            form.instance.owner = self.request.user
        self.object = form.save()
        permissions = self.get_permissions()
        user_data = self.get_user_data()
        # User does not have the cookie yet.
        if not self.object.owner:
            anonymous_url = self.object.get_anonymous_edit_url()
            permissions["anonymous_edit_url"] = anonymous_url
            user_data["is_owner"] = True
        response = simple_json_response(
            id=self.object.pk,
            url=self.object.get_absolute_url(),
            permissions=permissions,
            user=user_data,
        )
        if not self.request.user.is_authenticated:
            key, value = self.object.signed_cookie_elements
            response.set_signed_cookie(
                key=key, value=value, max_age=ANONYMOUS_COOKIE_MAX_AGE
            )
        return response


def get_websocket_auth_token(request, map_id, map_inst):
    """Return an signed authentication token for the currently
    connected user, allowing edits for this map over WebSocket.

    If the user is anonymous, return a signed token with the map id.

    The returned token is a signed object with the following keys:
    - user: user primary key OR "anonymous"
    - map_id: the map id
    - permissions: a list of allowed permissions for this user and this map
    """
    map_object: Map = Map.objects.get(pk=map_id)

    permissions = ["edit"]
    if map_object.is_owner(request):
        permissions.append("owner")

    if request.user.is_authenticated:
        user = request.user.pk
    else:
        user = "anonymous"
    signed_token = TimestampSigner().sign_object(
        {"user": user, "map_id": map_id, "permissions": permissions}
    )
    return simple_json_response(token=signed_token)


class MapUpdate(FormLessEditMixin, PermissionsMixin, SessionMixin, UpdateView):
    model = Map
    form_class = MapSettingsForm
    pk_url_kwarg = "map_id"

    def form_valid(self, form):
        self.object.settings = form.cleaned_data["settings"]
        self.object.save()
        return simple_json_response(
            id=self.object.pk,
            url=self.object.get_absolute_url(),
            permissions=self.get_permissions(),
            user=self.get_user_data(),
        )


class UpdateMapPermissions(FormLessEditMixin, UpdateView):
    model = Map
    pk_url_kwarg = "map_id"

    def get_form_class(self):
        if self.object.owner:
            return UpdateMapPermissionsForm
        else:
            return AnonymousMapPermissionsForm

    def get_form(self, form_class=None):
        form = super().get_form(form_class)
        user = self.request.user
        if self.object.owner and not user == self.object.owner:
            del form.fields["edit_status"]
            del form.fields["share_status"]
            del form.fields["owner"]
        return form

    def form_valid(self, form):
        self.object = form.save()
        return simple_json_response(info=_("Map editors updated with success!"))


class AttachAnonymousMap(View):
    def post(self, *args, **kwargs):
        self.object = kwargs["map_inst"]
        if (
            self.object.owner
            or not self.object.is_anonymous_owner(self.request)
            or not self.object.can_edit(self.request)
            or not self.request.user.is_authenticated
        ):
            return HttpResponseForbidden()
        self.object.owner = self.request.user
        self.object.save()
        return simple_json_response()


class SendEditLink(FormLessEditMixin, FormView):
    form_class = SendLinkForm

    def post(self, form, **kwargs):
        self.object = kwargs["map_inst"]
        if (
            self.object.owner
            or not self.object.is_anonymous_owner(self.request)
            or not self.object.can_edit(self.request)
        ):
            return HttpResponseForbidden()
        form = self.get_form()
        if form.is_valid():
            email = form.cleaned_data["email"]
        else:
            return HttpResponseBadRequest("Invalid")
        link = self.object.get_anonymous_edit_url()

        subject = _("The uMap edit link for your map: %(map_name)s") % {
            "map_name": self.object.name
        }
        body = _("Here is your secret edit link: %(link)s") % {"link": link}
        try:
            send_mail(
                subject, body, settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False
            )
        except SMTPException:
            return simple_json_response(
                error=_("Can't send email to %(email)s" % {"email": email})
            )
        return simple_json_response(
            info=_("Email sent to %(email)s") % {"email": email}
        )


class MapDelete(DeleteView):
    model = Map
    pk_url_kwarg = "map_id"

    def form_valid(self, form):
        self.object = self.get_object()
        if not self.object.can_delete(self.request):
            return HttpResponseForbidden(_("Only its owner can delete the map."))
        self.object.delete()
        home_url = reverse("home")
        messages.info(self.request, _("Map successfully deleted."))
        if is_ajax(self.request):
            return simple_json_response(redirect=home_url)
        else:
            return HttpResponseRedirect(form.data.get("next") or home_url)


class MapClone(PermissionsMixin, View):
    def post(self, *args, **kwargs):
        if (
            not getattr(settings, "UMAP_ALLOW_ANONYMOUS", False)
            and not self.request.user.is_authenticated
        ):
            return HttpResponseForbidden()
        owner = self.request.user if self.request.user.is_authenticated else None
        self.object = kwargs["map_inst"].clone(owner=owner)
        if is_ajax(self.request):
            response = simple_json_response(redirect=self.object.get_absolute_url())
        else:
            response = HttpResponseRedirect(self.object.get_absolute_url())
        if not self.request.user.is_authenticated:
            key, value = self.object.signed_cookie_elements
            response.set_signed_cookie(
                key=key, value=value, max_age=ANONYMOUS_COOKIE_MAX_AGE
            )
            msg = _(
                "Your map has been cloned! If you want to edit this map from "
                "another computer, please use this link: %(anonymous_url)s"
                % {"anonymous_url": self.object.get_anonymous_edit_url()}
            )
        else:
            msg = _("Congratulations, your map has been cloned!")
        messages.info(self.request, msg)
        return response


class ToggleMapStarStatus(View):
    def post(self, *args, **kwargs):
        map_inst = get_object_or_404(Map, pk=kwargs["map_id"])
        qs = Star.objects.filter(map=map_inst, by=self.request.user)
        if qs.exists():
            qs.delete()
            status = False
        else:
            Star.objects.create(map=map_inst, by=self.request.user)
            status = True
        return simple_json_response(starred=status)


class MapShortUrl(RedirectView):
    query_string = True
    permanent = True

    def get_redirect_url(self, **kwargs):
        map_inst = get_object_or_404(Map, pk=kwargs["pk"])
        url = map_inst.get_absolute_url()
        if self.query_string:
            args = self.request.META.get("QUERY_STRING", "")
            if args:
                url = "%s?%s" % (url, args)
        return url


class MapAnonymousEditUrl(RedirectView):
    permanent = False

    def get(self, request, *args, **kwargs):
        signer = Signer()
        try:
            pk = signer.unsign(self.kwargs["signature"])
        except BadSignature:
            signer = Signer(algorithm="sha1")
            try:
                pk = signer.unsign(self.kwargs["signature"])
            except BadSignature:
                return HttpResponseForbidden()

        map_inst = get_object_or_404(Map, pk=pk)
        url = map_inst.get_absolute_url()
        response = HttpResponseRedirect(url)
        if not map_inst.owner:
            key, value = map_inst.signed_cookie_elements
            response.set_signed_cookie(
                key=key, value=value, max_age=ANONYMOUS_COOKIE_MAX_AGE
            )
        return response


# ############## #
#    DataLayer   #
# ############## #


class GZipMixin(object):
    EXT = ".gz"

    @property
    def path(self):
        return Path(self.object.geojson.path)

    @property
    def gzip_path(self):
        return Path(f"{self.path}{self.EXT}")

    def read_version(self, path):
        # Remove optional .gz, then .geojson, then return the trailing version from path.
        return str(path.with_suffix("").with_suffix("")).split("_")[-1]

    @property
    def version(self):
        # Prior to 1.3.0 we did not set gzip mtime as geojson mtime,
        # but we switched from If-Match header to If-Unmodified-Since
        # and when users accepts gzip their last modified value is the gzip
        # (when umap is served by nginx and X-Accel-Redirect)
        # one, so we need to compare with that value in that case.
        # cf https://github.com/umap-project/umap/issues/1212
        path = (
            self.gzip_path
            if self.accepts_gzip and self.gzip_path.exists()
            else self.path
        )
        return self.read_version(path)

    @property
    def accepts_gzip(self):
        return settings.UMAP_GZIP and re_accepts_gzip.search(
            self.request.META.get("HTTP_ACCEPT_ENCODING", "")
        )


class DataLayerView(GZipMixin, BaseDetailView):
    model = DataLayer

    def render_to_response(self, context, **response_kwargs):
        response = None
        path = self.path
        # Generate gzip if needed
        if self.accepts_gzip:
            if not self.gzip_path.exists():
                gzip_file(path, self.gzip_path)

        if getattr(settings, "UMAP_XSENDFILE_HEADER", None):
            response = HttpResponse()
            internal_path = str(path).replace(settings.MEDIA_ROOT, "/internal")
            response[settings.UMAP_XSENDFILE_HEADER] = internal_path
        else:
            # Do not use in production
            # (no gzip/cache-control/If-Modified-Since/If-None-Match)
            statobj = os.stat(path)
            with open(path, "rb") as f:
                # Should not be used in production!
                response = HttpResponse(f.read(), content_type="application/geo+json")
            response["X-Datalayer-Version"] = self.version
            response["Content-Length"] = statobj.st_size
        return response


class DataLayerVersion(DataLayerView):
    @property
    def path(self):
        return Path(settings.MEDIA_ROOT) / self.object.get_version_path(
            self.kwargs["name"]
        )


class DataLayerCreate(FormLessEditMixin, GZipMixin, CreateView):
    model = DataLayer
    form_class = DataLayerForm

    def form_valid(self, form):
        form.instance.map = self.kwargs["map_inst"]
        self.object = form.save()
        # Simple response with only metadata (including new id)
        response = simple_json_response(**self.object.metadata(self.request))
        response["X-Datalayer-Version"] = self.version
        return response


class DataLayerUpdate(FormLessEditMixin, GZipMixin, UpdateView):
    model = DataLayer
    form_class = DataLayerForm

    def has_changes_since(self, incoming_version):
        return incoming_version and self.version != incoming_version

    def merge(self, reference_version):
        """
        Attempt to apply the incoming changes to the reference, and then merge it
        with the last document we have on storage.

        Returns either None (if the merge failed) or the merged python GeoJSON object.
        """

        # Use the provided info to find the correct version in our storage.
        for version in self.object.versions:
            name = version["name"]
            path = Path(settings.MEDIA_ROOT) / self.object.get_version_path(name)
            if reference_version == self.read_version(path):
                with open(path) as f:
                    reference = json.loads(f.read())
                break
        else:
            # If the reference document is not found, we can't merge.
            return None
        # New data received in the request.
        incoming = json.loads(self.request.FILES["geojson"].read())

        # Latest known version of the data.
        with open(self.path) as f:
            latest = json.loads(f.read())

        try:
            merged_features = merge_features(
                reference.get("features", []),
                latest.get("features", []),
                incoming.get("features", []),
            )
            latest["features"] = merged_features
            return latest
        except ConflictError:
            return None

    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        if self.object.map.pk != int(self.kwargs["map_id"]):
            return HttpResponseForbidden()

        if not self.object.can_edit(request=self.request):
            return HttpResponseForbidden()

        reference_version = self.request.headers.get("X-Datalayer-Reference")
        if self.has_changes_since(reference_version):
            merged = self.merge(reference_version)
            if not merged:
                return HttpResponse(status=412)

            # Replace the uploaded file by the merged version.
            self.request.FILES["geojson"].file = BytesIO(
                json_dumps(merged).encode("utf-8")
            )

            # Mark the data to be reloaded by form_valid
            self.request.session["needs_reload"] = True
        return super().post(request, *args, **kwargs)

    def form_valid(self, form):
        self.object = form.save()
        data = {**self.object.metadata(self.request)}
        if self.request.session.get("needs_reload"):
            data["geojson"] = json.loads(self.object.geojson.read().decode())
            self.request.session["needs_reload"] = False
        response = simple_json_response(**data)
        response["X-Datalayer-Version"] = self.version
        return response


class DataLayerDelete(DeleteView):
    model = DataLayer

    def form_valid(self, form):
        self.object = self.get_object()
        if self.object.map != self.kwargs["map_inst"]:
            return HttpResponseForbidden()
        self.object.delete()
        return simple_json_response(info=_("Layer successfully deleted."))


class DataLayerVersions(BaseDetailView):
    model = DataLayer

    def render_to_response(self, context, **response_kwargs):
        return simple_json_response(versions=self.object.versions)


class UpdateDataLayerPermissions(FormLessEditMixin, UpdateView):
    model = DataLayer
    pk_url_kwarg = "pk"

    def get_form_class(self):
        if self.object.map.owner:
            return DataLayerPermissionsForm
        else:
            return AnonymousDataLayerPermissionsForm

    def form_valid(self, form):
        self.object = form.save()
        return simple_json_response(info=_("Permissions updated with success!"))


# ############## #
#     Picto      #
# ############## #


class PictogramJSONList(ListView):
    model = Pictogram

    def render_to_response(self, context, **response_kwargs):
        content = [p.json for p in Pictogram.objects.all()]
        return simple_json_response(pictogram_list=content)


# ############## #
#     Generic    #
# ############## #


def stats(request):
    last_week = make_aware(datetime.now()) - timedelta(days=7)
    return simple_json_response(
        **{
            "version": VERSION,
            "maps_count": Map.objects.count(),
            "maps_active_last_week_count": Map.objects.filter(
                modified_at__gt=last_week
            ).count(),
            "users_count": User.objects.count(),
            "users_active_last_week_count": User.objects.filter(
                last_login__gt=last_week
            ).count(),
        }
    )


@require_GET
@cache_control(max_age=60 * 60 * 24, immutable=True, public=True)  # One day.
def webmanifest(request):
    return simple_json_response(
        **{
            "icons": [
                {
                    "src": staticfiles_storage.url("umap/favicons/icon-192.png"),
                    "type": "image/png",
                    "sizes": "192x192",
                },
                {
                    "src": staticfiles_storage.url("umap/favicons/icon-512.png"),
                    "type": "image/png",
                    "sizes": "512x512",
                },
            ]
        }
    )


def logout(request):
    do_logout(request)
    return HttpResponseRedirect("/")


class LoginPopupEnd(TemplateView):
    """
    End of a login process in popup.
    Basically close the popup.
    """

    template_name = "umap/login_popup_end.html"
