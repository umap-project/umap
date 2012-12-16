from django.views.generic import TemplateView
from django.contrib.auth.models import User
from django.views.generic import DetailView
from django.db.models import Q

from sesql.shortquery import shortquery

from chickpea.models import Map


class Home(TemplateView):
    template_name = "youmap/home.html"
    list_template_name = "chickpea/map_list.html"

    def get_context_data(self, **kwargs):
        maps = Map.objects.order_by('-modified_at')[:100]
        users = User.objects.filter(is_staff=False)[:10]
        return {
            "maps": maps,
            "users": users
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


class UserMaps(DetailView):
    model = User
    slug_url_kwarg = 'username'
    slug_field = 'username'
    list_template_name = "chickpea/map_list.html"
    context_object_name = "current_user"

    def get_context_data(self, **kwargs):
        maps = Map.objects.filter(owner=self.object).order_by('-modified_at')[:30]
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


class Search(TemplateView):
    template_name = "youmap/search.html"
    list_template_name = "chickpea/map_list.html"

    def get_context_data(self, **kwargs):
        q = self.request.GET['q']
        maps = shortquery(Q(fulltext__containswords=q))
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
