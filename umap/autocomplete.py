from django.conf import settings
from django.contrib.auth import get_user_model


from agnocomplete.register import register
from agnocomplete.core import AgnocompleteModel


@register
class AutocompleteUser(AgnocompleteModel):
    model = get_user_model()
    fields = settings.USER_AUTOCOMPLETE_FIELDS

    def item(self, current_item):
        data = super().item(current_item)
        data['url'] = current_item.get_url()
        return data
