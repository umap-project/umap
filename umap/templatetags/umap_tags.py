from copy import copy

from django import template

register = template.Library()


@register.inclusion_tag('umap/field.html')
def foundation_field(field):
    return {
        'field': field,
    }


@register.simple_tag(takes_context=True)
def paginate_querystring(context, page):
    qs = copy(context["request"].GET)
    qs["p"] = page
    return qs.urlencode()


@register.filter
def ipdb(what):
    import ipdb
    ipdb.set_trace()
    return ''
