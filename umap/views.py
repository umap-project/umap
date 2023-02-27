import hashlib
import json
import os
import re
import socket

import mimetypes
from django.conf import settings
from django.contrib import messages
from django.contrib.auth import logout as do_logout
from django.contrib.auth import get_user_model
from django.contrib.gis.measure import D
from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.core.signing import BadSignature, Signer
from django.core.validators import URLValidator, ValidationError
from django.db.models import Q
from django.http import (HttpResponse, HttpResponseBadRequest,
                         HttpResponseForbidden, HttpResponsePermanentRedirect,
                         HttpResponseRedirect)
from django.middleware.gzip import re_accepts_gzip
from django.shortcuts import get_object_or_404
from django.template.loader import render_to_string
from django.urls import reverse, reverse_lazy
from django.utils.encoding import force_bytes, smart_bytes
from django.utils.http import http_date
from django.utils.translation import gettext as _
from django.utils.translation import to_locale
from django.views.generic import DetailView, TemplateView, View
from django.views.generic.base import RedirectView
from django.views.generic.detail import BaseDetailView
from django.views.generic.edit import CreateView, DeleteView, UpdateView
from django.views.generic.list import ListView

from .forms import (DEFAULT_LATITUDE, DEFAULT_LONGITUDE, DEFAULT_CENTER,
                    AnonymousMapPermissionsForm, DataLayerForm, FlatErrorList,
                    MapSettingsForm, UpdateMapPermissionsForm)
from .models import DataLayer, Licence, Map, Pictogram, TileLayer
from .utils import get_uri_template, gzip_file, is_ajax

try:
    # python3
    from urllib.parse import urlparse
    from urllib.request import Request, build_opener
    from urllib.error import HTTPError
except ImportError:
    from urlparse import urlparse
    from urllib2 import Request, HTTPError, build_opener


User = get_user_model()


PRIVATE_IP = re.compile(
    r"((^127\.)|(^10\.)"
    r"|(^172\.1[6-9]\.)"
    r"|(^172\.2[0-9]\.)"
    r"|(^172\.3[0-1]\.)"
    r"|(^192\.168\.))"
)
ANONYMOUS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # One month


class PaginatorMixin(object):
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


class Home(TemplateView, PaginatorMixin):
    template_name = "umap/home.html"
    list_template_name = "umap/map_list.html"

    def get_context_data(self, **kwargs):
        qs = Map.public
        if (
            settings.UMAP_EXCLUDE_DEFAULT_MAPS
            and "spatialite" not in settings.DATABASES["default"]["ENGINE"]
        ):
            # Unsupported query type for sqlite.
            qs = qs.filter(center__distance_gt=(DEFAULT_CENTER, D(km=1)))
        demo_map = None
        if hasattr(settings, "UMAP_DEMO_PK"):
            try:
                demo_map = Map.public.get(pk=settings.UMAP_DEMO_PK)
            except Map.DoesNotExist:
                pass
            else:
                qs = qs.exclude(id=demo_map.pk)
        showcase_map = None
        if hasattr(settings, "UMAP_SHOWCASE_PK"):
            try:
                showcase_map = Map.public.get(pk=settings.UMAP_SHOWCASE_PK)
            except Map.DoesNotExist:
                pass
            else:
                qs = qs.exclude(id=showcase_map.pk)
        maps = qs.order_by("-modified_at")[:50]
        maps = self.paginate(maps, settings.UMAP_MAPS_PER_PAGE)

        return {
            "maps": maps,
            "demo_map": demo_map,
            "showcase_map": showcase_map,
            "DEMO_SITE": settings.UMAP_DEMO_SITE,
        }

    def get_template_names(self):
        """
        Dispatch template according to the kind of request: ajax or normal.
        """
        if is_ajax(self.request):
            return [self.list_template_name]
        else:
            return [self.template_name]


home = Home.as_view()


class About(Home):

    template_name = "umap/about.html"


about = About.as_view()


class UserMaps(DetailView, PaginatorMixin):
    model = User
    slug_url_kwarg = "username"
    slug_field = "username"
    list_template_name = "umap/map_list.html"
    context_object_name = "current_user"

    def get_context_data(self, **kwargs):
        owner = self.request.user == self.object
        manager = Map.objects if owner else Map.public
        maps = manager.filter(Q(owner=self.object) | Q(editors=self.object))
        if owner:
            per_page = settings.UMAP_MAPS_PER_PAGE_OWNER
            limit = 100
        else:
            per_page = settings.UMAP_MAPS_PER_PAGE
            limit = 50
        maps = maps.distinct().order_by("-modified_at")[:limit]
        maps = self.paginate(maps, per_page)
        kwargs.update({"maps": maps})
        return super(UserMaps, self).get_context_data(**kwargs)

    def get_template_names(self):
        """
        Dispatch template according to the kind of request: ajax or normal.
        """
        if is_ajax(self.request):
            return [self.list_template_name]
        else:
            return super(UserMaps, self).get_template_names()


user_maps = UserMaps.as_view()


class Search(TemplateView, PaginatorMixin):
    template_name = "umap/search.html"
    list_template_name = "umap/map_list.html"

    def get_context_data(self, **kwargs):
        q = self.request.GET.get("q")
        results = []
        if q:
            where = "to_tsvector(name) @@ plainto_tsquery(%s)"
            if getattr(settings, "UMAP_USE_UNACCENT", False):
                where = "to_tsvector(unaccent(name)) @@ plainto_tsquery(unaccent(%s))"  # noqa
            results = Map.objects.filter(share_status=Map.PUBLIC)
            results = results.extra(where=[where], params=[q])
            results = results.order_by("-modified_at")
            results = self.paginate(results)
        kwargs.update({"maps": results, "q": q})
        return kwargs

    def get_template_names(self):
        """
        Dispatch template according to the kind of request: ajax or normal.
        """
        if is_ajax(self.request):
            return [self.list_template_name]
        else:
            return super(Search, self).get_template_names()


search = Search.as_view()


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
                    url=reverse("user_maps", kwargs={"username": m.owner.username}),
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
        return HttpResponse(smart_bytes(json.dumps(geojson)))


showcase = MapsShowCase.as_view()


def validate_url(request):
    assert request.method == "GET"
    assert is_ajax(request)
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
        # You should not use this in production (use Nginx or so)
        try:
            url = validate_url(self.request)
        except AssertionError:
            return HttpResponseBadRequest()
        headers = {"User-Agent": "uMapProxy +http://wiki.openstreetmap.org/wiki/UMap"}
        request = Request(url, headers=headers)
        opener = build_opener()
        try:
            proxied_request = opener.open(request)
        except HTTPError as e:
            return HttpResponse(e.msg, status=e.code, content_type="text/plain")
        else:
            status_code = proxied_request.code
            mimetype = proxied_request.headers.get(
                "Content-Type"
            ) or mimetypes.guess_type(
                url
            )  # noqa
            content = proxied_request.read()
            # Quick hack to prevent Django from adding a Vary: Cookie header
            self.request.session.accessed = False
            response = HttpResponse(content, status=status_code, content_type=mimetype)
            try:
                ttl = int(self.request.GET.get("ttl"))
            except (TypeError, ValueError):
                pass
            else:
                response["X-Accel-Expires"] = ttl
            return response


ajax_proxy = AjaxProxy.as_view()


# ############## #
#     Utils      #
# ############## #


def _urls_for_js(urls=None):
    """
    Return templated URLs prepared for javascript.
    """
    if urls is None:
        # prevent circular import
        from .urls import urlpatterns, i18n_urls

        urls = [
            url.name for url in urlpatterns + i18n_urls if getattr(url, "name", None)
        ]
    urls = dict(zip(urls, [get_uri_template(url) for url in urls]))
    urls.update(getattr(settings, "UMAP_EXTRA_URLS", {}))
    return urls


def render_to_json(templates, context, request):
    """
    Generate a JSON HttpResponse with rendered template HTML.
    """
    html = render_to_string(templates, context=context, request=request)
    _json = json.dumps({"html": html})
    return HttpResponse(_json)


def simple_json_response(**kwargs):
    return HttpResponse(json.dumps(kwargs))


# ############## #
#      Map       #
# ############## #


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


class MapDetailMixin:

    model = Map

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        properties = {
            "urls": _urls_for_js(),
            "tilelayers": TileLayer.get_list(),
            "allowEdit": self.is_edit_allowed(),
            "default_iconUrl": "%sumap/img/marker.png" % settings.STATIC_URL,  # noqa
            "umap_id": self.get_umap_id(),
            "licences": dict((l.name, l.json) for l in Licence.objects.all()),
            "edit_statuses": [(i, str(label)) for i, label in Map.EDIT_STATUS],
            "share_statuses": [
                (i, str(label)) for i, label in Map.SHARE_STATUS if i != Map.BLOCKED
            ],
            "anonymous_edit_statuses": [
                (i, str(label)) for i, label in AnonymousMapPermissionsForm.STATUS
            ],
        }
        if self.get_short_url():
            properties["shortUrl"] = self.get_short_url()

        if settings.USE_I18N:
            locale = settings.LANGUAGE_CODE
            # Check attr in case the middleware is not active
            if hasattr(self.request, "LANGUAGE_CODE"):
                locale = self.request.LANGUAGE_CODE
            locale = to_locale(locale)
            properties["locale"] = locale
            context["locale"] = locale
        user = self.request.user
        if not user.is_anonymous:
            properties["user"] = {
                "id": user.pk,
                "name": user.get_username(),
                "url": reverse(settings.USER_MAPS_URL, args=(user.get_username(),)),
            }
        map_settings = self.get_geojson()
        if "properties" not in map_settings:
            map_settings["properties"] = {}
        map_settings["properties"].update(properties)
        map_settings["properties"]["datalayers"] = self.get_datalayers()
        context["map_settings"] = json.dumps(map_settings, indent=settings.DEBUG)
        return context

    def get_datalayers(self):
        return []

    def is_edit_allowed(self):
        return True

    def get_umap_id(self):
        return None

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
                "name": self.object.owner.get_username(),
                "url": reverse(
                    settings.USER_MAPS_URL, args=(self.object.owner.get_username(),)
                ),
            }
            permissions["editors"] = [
                {
                    "id": editor.pk,
                    "name": editor.get_username(),
                }
                for editor in self.object.editors.all()
            ]
        if not self.object.owner and self.object.is_anonymous_owner(self.request):
            permissions["anonymous_edit_url"] = self.get_anonymous_edit_url()
        return permissions

    def get_anonymous_edit_url(self):
        anonymous_url = self.object.get_anonymous_edit_url()
        return settings.SITE_URL + anonymous_url


class MapView(MapDetailMixin, PermissionsMixin, DetailView):
    def get(self, request, *args, **kwargs):
        self.object = self.get_object()
        canonical = self.get_canonical_url()
        if not request.path == canonical:
            if request.META.get("QUERY_STRING"):
                canonical = "?".join([canonical, request.META["QUERY_STRING"]])
            return HttpResponsePermanentRedirect(canonical)
        if not self.object.can_view(request):
            return HttpResponseForbidden()
        return super(MapView, self).get(request, *args, **kwargs)

    def get_canonical_url(self):
        return self.object.get_absolute_url()

    def get_datalayers(self):
        datalayers = DataLayer.objects.filter(map=self.object)
        return [l.metadata for l in datalayers]

    def is_edit_allowed(self):
        return self.object.can_edit(self.request.user, self.request)

    def get_umap_id(self):
        return self.object.pk

    def get_short_url(self):
        shortUrl = None
        if hasattr(settings, "SHORT_SITE_URL"):
            short_path = reverse_lazy("map_short_url", kwargs={"pk": self.object.pk})
            shortUrl = "%s%s" % (settings.SHORT_SITE_URL, short_path)
        return shortUrl

    def get_geojson(self):
        map_settings = self.object.settings
        if "properties" not in map_settings:
            map_settings["properties"] = {}
        map_settings["properties"]["name"] = self.object.name
        map_settings["properties"]["permissions"] = self.get_permissions()
        return map_settings


class MapViewGeoJSON(MapView):
    def get_canonical_url(self):
        return reverse("map_geojson", args=(self.object.pk,))

    def render_to_response(self, context, *args, **kwargs):
        return HttpResponse(context["map_settings"], content_type="application/json")


class MapNew(MapDetailMixin, TemplateView):
    template_name = "umap/map_detail.html"


class MapCreate(FormLessEditMixin, PermissionsMixin, CreateView):
    model = Map
    form_class = MapSettingsForm

    def form_valid(self, form):
        if self.request.user.is_authenticated:
            form.instance.owner = self.request.user
        self.object = form.save()
        anonymous_url = self.get_anonymous_edit_url()
        if not self.request.user.is_authenticated:
            msg = _(
                "Your map has been created! If you want to edit this map from "
                "another computer, please use this link: %(anonymous_url)s"
                % {"anonymous_url": anonymous_url}
            )
        else:
            msg = _("Congratulations, your map has been created!")
        permissions = self.get_permissions()
        # User does not have the cookie yet.
        permissions["anonymous_edit_url"] = anonymous_url
        response = simple_json_response(
            id=self.object.pk,
            url=self.object.get_absolute_url(),
            permissions=permissions,
            info=msg,
        )
        if not self.request.user.is_authenticated:
            key, value = self.object.signed_cookie_elements
            response.set_signed_cookie(
                key=key, value=value, max_age=ANONYMOUS_COOKIE_MAX_AGE
            )
        return response


class MapUpdate(FormLessEditMixin, PermissionsMixin, UpdateView):
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
            info=_("Map has been updated!"),
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
            or not self.object.can_edit(self.request.user, self.request)
            or not self.request.user.is_authenticated
        ):
            return HttpResponseForbidden()
        self.object.owner = self.request.user
        self.object.save()
        return simple_json_response()


class MapDelete(DeleteView):
    model = Map
    pk_url_kwarg = "map_id"

    def form_valid(self, form):
        self.object = self.get_object()
        if self.object.owner and self.request.user != self.object.owner:
            return HttpResponseForbidden(_("Only its owner can delete the map."))
        if not self.object.owner and not self.object.is_anonymous_owner(self.request):
            return HttpResponseForbidden()
        self.object.delete()
        return simple_json_response(redirect="/")


class MapClone(PermissionsMixin, View):
    def post(self, *args, **kwargs):
        if (
            not getattr(settings, "UMAP_ALLOW_ANONYMOUS", False)
            and not self.request.user.is_authenticated
        ):
            return HttpResponseForbidden()
        owner = self.request.user if self.request.user.is_authenticated else None
        self.object = kwargs["map_inst"].clone(owner=owner)
        response = simple_json_response(redirect=self.object.get_absolute_url())
        if not self.request.user.is_authenticated:
            key, value = self.object.signed_cookie_elements
            response.set_signed_cookie(
                key=key, value=value, max_age=ANONYMOUS_COOKIE_MAX_AGE
            )
            msg = _(
                "Your map has been cloned! If you want to edit this map from "
                "another computer, please use this link: %(anonymous_url)s"
                % {"anonymous_url": self.get_anonymous_edit_url()}
            )
        else:
            msg = _("Congratulations, your map has been cloned!")
        messages.info(self.request, msg)
        return response


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
            return HttpResponseForbidden()
        else:
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

    EXT = '.gz'

    def _path(self):
        return self.object.geojson.path

    def path(self):
        """
        Serve gzip file if client accept it.
        Generate or update the gzip file if needed.
        """
        path = self._path()
        statobj = os.stat(path)
        ae = self.request.META.get('HTTP_ACCEPT_ENCODING', '')
        if re_accepts_gzip.search(ae) and getattr(settings, 'UMAP_GZIP', True):
            gzip_path = "{path}{ext}".format(path=path, ext=self.EXT)
            up_to_date = True
            if not os.path.exists(gzip_path):
                up_to_date = False
            else:
                gzip_statobj = os.stat(gzip_path)
                if statobj.st_mtime > gzip_statobj.st_mtime:
                    up_to_date = False
            if not up_to_date:
                gzip_file(path, gzip_path)
            path = gzip_path
        return path

    def etag(self):
        path = self.path()
        with open(path, mode='rb') as f:
            return hashlib.md5(f.read()).hexdigest()


class DataLayerView(GZipMixin, BaseDetailView):
    model = DataLayer

    def render_to_response(self, context, **response_kwargs):
        response = None
        path = self.path()

        if getattr(settings, 'UMAP_XSENDFILE_HEADER', None):
            response = HttpResponse()
            path = path.replace(settings.MEDIA_ROOT, "/internal")
            response[settings.UMAP_XSENDFILE_HEADER] = path
        else:
            # TODO IMS
            statobj = os.stat(path)
            with open(path, "rb") as f:
                # Should not be used in production!
                response = HttpResponse(
                    f.read(),
                    content_type="application/json"
                )
            response["Last-Modified"] = http_date(statobj.st_mtime)
            response['ETag'] = '%s' % hashlib.md5(force_bytes(response.content)).hexdigest()  # noqa
            response['Content-Length'] = len(response.content)
        if path.endswith(self.EXT):
            response['Content-Encoding'] = 'gzip'
        return response


class DataLayerVersion(DataLayerView):
    def _path(self):
        return "{root}/{path}".format(
            root=settings.MEDIA_ROOT,
            path=self.object.get_version_path(self.kwargs["name"]),
        )


class DataLayerCreate(FormLessEditMixin, GZipMixin, CreateView):
    model = DataLayer
    form_class = DataLayerForm

    def form_valid(self, form):
        form.instance.map = self.kwargs['map_inst']
        self.object = form.save()
        response = simple_json_response(**self.object.metadata)
        response['ETag'] = self.etag()
        return response


class DataLayerUpdate(FormLessEditMixin, GZipMixin, UpdateView):
    model = DataLayer
    form_class = DataLayerForm

    def form_valid(self, form):
        self.object = form.save()
        response = simple_json_response(**self.object.metadata)
        response['ETag'] = self.etag()
        return response

    def if_match(self):
        """Optimistic concurrency control."""
        match = True
        if_match = self.request.META.get('HTTP_IF_MATCH')
        if if_match:
            etag = self.etag()
            if etag != if_match:
                match = False
        return match

    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        if self.object.map != self.kwargs["map_inst"]:
            return HttpResponseForbidden()
        if not self.if_match():
            return HttpResponse(status=412)
        return super(DataLayerUpdate, self).post(request, *args, **kwargs)


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


def logout(request):
    do_logout(request)
    return simple_json_response(redirect="/")


class LoginPopupEnd(TemplateView):
    """
    End of a loggin process in popup.
    Basically close the popup.
    """

    template_name = "umap/login_popup_end.html"
