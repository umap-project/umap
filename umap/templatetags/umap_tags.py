from django import template

register = template.Library()


@register.inclusion_tag('umap/field.html')
def foundation_field(field):
    return {
        'field': field,
    }
