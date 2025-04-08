from agnocomplete.core import AgnocompleteModel
from agnocomplete.register import register
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models.functions import Length


@register
class AutocompleteUser(AgnocompleteModel):
    model = get_user_model()
    fields = settings.USER_AUTOCOMPLETE_FIELDS

    def item(self, current_item):
        data = super().item(current_item)
        data["url"] = current_item.get_url()
        return data

    def build_extra_filtered_queryset(self, queryset, **kwargs):
        order_by = []
        for field_name in self.fields:
            if not field_name[0].isalnum():
                field_name = field_name[1:]
            order_by.append(Length(field_name).asc())
        return queryset.order_by(*order_by)
