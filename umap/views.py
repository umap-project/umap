from django.views.generic import TemplateView
from django.contrib.auth.models import User
from django.views.generic import DetailView
from django.db.models import Q
from django.contrib.gis.measure import D
from django.conf import settings
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger

from sesql.shortquery import shortquery

from leaflet_storage.models import Map
from leaflet_storage.forms import DEFAULT_CENTER


class PaginatorMixin(object):
    per_page = 5

    def paginate(self, qs):
        paginator = Paginator(qs, self.per_page)
        page = self.request.GET.get('p')
        try:
            qs = paginator.page(page)
        except PageNotAnInteger:
            # If page is not an integer, deliver first page.
            qs = paginator.page(1)
        except EmptyPage:
            # If page is out of range (e.g. 9999), deliver last page of results.
            qs = paginator.page(paginator.num_pages)
        return qs


class Home(TemplateView, PaginatorMixin):
    template_name = "umap/home.html"
    list_template_name = "leaflet_storage/map_list.html"

    def get_context_data(self, **kwargs):
        qs = Map.objects.filter(center__distance_gt=(DEFAULT_CENTER, D(km=1)))
        demo_map = None
        if hasattr(settings, "UMAP_DEMO_PK"):
            try:
                demo_map = Map.objects.get(pk=settings.UMAP_DEMO_PK)
            except Map.DoesNotExist:
                pass
            else:
                qs = qs.exclude(id=demo_map.pk)
        maps = qs.order_by('-modified_at')[:50]
        maps = self.paginate(maps)

        return {
            "maps": maps,
            "demo_map": demo_map,
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
        maps = Map.objects.filter(Q(owner=self.object) | Q(editors=self.object)).distinct().order_by('-modified_at')[:30]
        maps = self.paginate(maps)
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
        maps = []
        if q:
            maps = shortquery(Q(classname='Map') & Q(fulltext__containswords=q))
            maps = self.paginate(maps)
        kwargs.update({
            'maps': maps,
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
