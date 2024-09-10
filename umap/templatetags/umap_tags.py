from copy import copy

from django import template
from django.conf import settings

from umap.utils import json_dumps

register = template.Library()


@register.inclusion_tag("umap/css.html")
def umap_css():
    return {"STATIC_URL": settings.STATIC_URL}


@register.inclusion_tag("umap/js.html")
def umap_js(locale=None):
    return {"STATIC_URL": settings.STATIC_URL, "locale": locale}


@register.inclusion_tag("umap/map_fragment.html")
def map_fragment(map_instance, **kwargs):
    map_settings = map_instance.preview_settings
    map_settings["properties"].update(kwargs)
    prefix = kwargs.pop("prefix", None) or "map"
    page = kwargs.pop("page", None) or ""
    unique_id = prefix + str(page) + "_" + str(map_instance.pk)
    return {
        "map_settings": json_dumps(map_settings),
        "map": map_instance,
        "unique_id": unique_id,
    }


@register.simple_tag
def tilelayer_preview(tilelayer):
    """
    Return an <img> tag with a tile of the tilelayer.
    """
    output = '<img src="{src}" alt="{alt}" title="{title}" />'
    url = tilelayer.url_template.format(s="a", z=9, x=265, y=181)
    output = output.format(src=url, alt=tilelayer.name, title=tilelayer.name)
    return output


@register.filter
def can_delete_map(map, request):
    return map.can_delete(request)


@register.filter
def notag(s):
    return s.replace("<", "&lt;")


@register.simple_tag(takes_context=True)
def paginate_querystring(context, page):
    qs = copy(context["request"].GET)
    qs["p"] = str(page)
    return qs.urlencode()


@register.filter
def ipdb(what):
    import ipdb

    ipdb.set_trace()
    return ""


@register.filter
def addstr(arg1, arg2):
    # Necessity: https://stackoverflow.com/a/23783666
    return str(arg1) + str(arg2)
