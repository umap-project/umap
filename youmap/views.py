from django.views.generic import TemplateView
from django.contrib.auth.models import User
from django.views.generic import DetailView

from chickpea.models import Map


class Home(TemplateView):
    template_name = "youmap/home.html"
    list_template_name = "chickpea/map_list.html"

    def get_context_data(self, **kwargs):
        maps = Map.objects.order_by('-modified_at')[:100]
        return {
            "maps": maps
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
