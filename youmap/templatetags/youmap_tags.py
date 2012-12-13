from django import template

register = template.Library()


@register.inclusion_tag('youmap/field.html')
def foundation_field(field):
    return {
        'field': field,
    }
