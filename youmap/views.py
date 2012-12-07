from django.views.generic import TemplateView

from chickpea.models import Map


class Home(TemplateView):
    template_name = "youmap/home.html"
    list_template_name = "chickpea/map_list.html"

    def get_context_data(self, **kwargs):
        maps = Map.objects.all()[:20]
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
