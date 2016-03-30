import json
import mimetypes
import socket

try:
    # python3
    from urllib.parse import urlparse
    from urllib.request import Request, build_opener
    from urllib.error import HTTPError
except ImportError:
    from urlparse import urlparse
    from urllib2 import Request, HTTPError, build_opener

from django.views.generic import TemplateView
from django.contrib.auth import get_user_model
from django.views.generic import DetailView, View
from django.db.models import Q
from django.contrib.gis.measure import D
from django.conf import settings
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.http import HttpResponse, HttpResponseBadRequest
from django.utils.translation import ugettext as _
from django.utils.encoding import smart_bytes
from django.core.urlresolvers import reverse
from django.core.validators import URLValidator, ValidationError

from leaflet_storage.models import Map
from leaflet_storage.forms import DEFAULT_CENTER

User = get_user_model()


class PaginatorMixin(object):
    per_page = 5

    def paginate(self, qs, per_page=None):
        paginator = Paginator(qs, per_page or self.per_page)
        page = self.request.GET.get('p')
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
    list_template_name = "leaflet_storage/map_list.html"

    def get_context_data(self, **kwargs):
        qs = Map.public
        if (settings.UMAP_EXCLUDE_DEFAULT_MAPS and
            'spatialite' not in settings.DATABASES['default']['ENGINE']):
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
        maps = qs.order_by('-modified_at')[:50]
        maps = self.paginate(maps, settings.UMAP_MAPS_PER_PAGE)

        return {
            "maps": maps,
            "demo_map": demo_map,
            "showcase_map": showcase_map,
            "DEMO_SITE": settings.UMAP_DEMO_SITE
        }

    def get_template_names(self):
        """
        Dispatch template according to the kind of request: ajax or normal.
        """
        if self.request.is_ajax():
            return [self.list_template_name]
        else:
            return [self.template_name]

home = Home.as_view()


class About(Home):

    template_name = "umap/about.html"

about = About.as_view()


class UserMaps(DetailView, PaginatorMixin):
    model = User
    slug_url_kwarg = 'username'
    slug_field = 'username'
    list_template_name = "leaflet_storage/map_list.html"
    context_object_name = "current_user"

    def get_context_data(self, **kwargs):
        owner = self.request.user == self.object
        manager = Map.objects if owner else Map.public
        maps = manager.filter(Q(owner=self.object) | Q(editors=self.object))
        maps = maps.distinct().order_by('-modified_at')[:50]
        if owner:
            per_page = settings.UMAP_MAPS_PER_PAGE_OWNER
        else:
            per_page = settings.UMAP_MAPS_PER_PAGE
        maps = self.paginate(maps, per_page)
        kwargs.update({
            "maps": maps
        })
        return super(UserMaps, self).get_context_data(**kwargs)

    def get_template_names(self):
        """
        Dispatch template according to the kind of request: ajax or normal.
        """
        if self.request.is_ajax():
            return [self.list_template_name]
        else:
            return super(UserMaps, self).get_template_names()

user_maps = UserMaps.as_view()


class Search(TemplateView, PaginatorMixin):
    template_name = "umap/search.html"
    list_template_name = "leaflet_storage/map_list.html"

    def get_context_data(self, **kwargs):
        q = self.request.GET.get('q')
        results = []
        if q:
            where = "to_tsvector(name) @@ plainto_tsquery(%s)"
            if getattr(settings, 'UMAP_USE_UNACCENT', False):
                where = "to_tsvector(unaccent(name)) @@ plainto_tsquery(unaccent(%s))"  # noqa
            results = Map.objects.filter(share_status=Map.PUBLIC)
            results = results.extra(where=[where], params=[q])
            results = results.order_by('-modified_at')
            results = self.paginate(results)
        kwargs.update({
            'maps': results,
            'q': q
        })
        return kwargs

    def get_template_names(self):
        """
        Dispatch template according to the kind of request: ajax or normal.
        """
        if self.request.is_ajax():
            return [self.list_template_name]
        else:
            return super(Search, self).get_template_names()

search = Search.as_view()


class MapsShowCase(View):

    def get(self, *args, **kwargs):
        maps = Map.public.filter(center__distance_gt=(DEFAULT_CENTER, D(km=1)))
        maps = maps.order_by('-modified_at')[:2500]

        def make(m):
            description = m.description or ""
            if m.owner:
                description = u"{description}\n{by} [[{url}|{name}]]".format(
                    description=description,
                    by=_("by"),
                    url=reverse('user_maps',
                                kwargs={"username": m.owner.username}),
                    name=m.owner,
                )
            description = u"{}\n[[{}|{}]]".format(
                description, m.get_absolute_url(), _("View the map"))
            geometry = m.settings.get('geometry', json.loads(m.center.geojson))
            return {
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "name": m.name,
                    "description": description
                }
            }

        geojson = {
            "type": "FeatureCollection",
            "features": [make(m) for m in maps]
        }
        return HttpResponse(smart_bytes(json.dumps(geojson)))

showcase = MapsShowCase.as_view()


def validate_url(request):
    assert request.method == "GET"
    assert request.is_ajax()
    url = request.GET.get('url')
    assert url
    try:
        URLValidator(url)
    except ValidationError:
        raise AssertionError()
    assert 'HTTP_REFERER' in request.META
    referer = urlparse(request.META.get('HTTP_REFERER'))
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
    assert not ipaddress.startswith('127.')
    assert not ipaddress.startswith('192.168.')
    return url


class AjaxProxy(View):

    def get(self, *args, **kwargs):
        # You should not use this in production (use Nginx or so)
        try:
            url = validate_url(self.request)
        except AssertionError as e:
            return HttpResponseBadRequest()
        headers = {
            'User-Agent': 'uMapProxy +http://wiki.openstreetmap.org/wiki/UMap'
        }
        request = Request(url, headers=headers)
        opener = build_opener()
        try:
            proxied_request = opener.open(request)
        except HTTPError as e:
            return HttpResponse(e.msg, status=e.code,
                                content_type='text/plain')
        else:
            status_code = proxied_request.code
            mimetype = proxied_request.headers.get('Content-Type') or mimetypes.guess_type(url)  # noqa
            content = proxied_request.read()
            # Quick hack to prevent Django from adding a Vary: Cookie header
            self.request.session.accessed = False
            return HttpResponse(content, status=status_code,
                                content_type=mimetype)
ajax_proxy = AjaxProxy.as_view()
