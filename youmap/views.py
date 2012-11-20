from django.views.generic import TemplateView

from chickpea.models import Map


class Home(TemplateView):
    template_name = "youmap/home.html"

    def get_context_data(self, **kwargs):
        maps = Map.objects.all()[:20]
        return {
            "maps": maps
        }

home = Home.as_view()
