from django.conf import settings
from django.contrib.auth import get_user_model
from django.urls import reverse


from agnocomplete.register import register
from agnocomplete.core import AgnocompleteModel


@register
class AutocompleteUser(AgnocompleteModel):
    model = get_user_model()
    fields = ['^username']

    def item(self, current_item):
        data = super().item(current_item)
        data['url'] = reverse(settings.USER_MAPS_URL,
                              args=(current_item.get_username(), ))
        return data
