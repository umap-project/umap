from agnocomplete.core import AgnocompleteModel
from agnocomplete.register import register
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q


@register
class AutocompleteUser(AgnocompleteModel):
    model = get_user_model()
    fields = settings.USER_AUTOCOMPLETE_FIELDS

    def item(self, current_item):
        data = super().item(current_item)
        data["url"] = current_item.get_url()
        return data

    def get_queryset_filters(self, query):
        if len(query) <= 3 and self._force_exact:
            conditions = Q()
            for field_name in self.fields:
                if not field_name[0].isalnum():
                    field_name = field_name[1:]
                # Force exact match
                conditions |= Q(**{self._construct_qs_filter(f"={field_name}"): query})
            return conditions

        return super().get_queryset_filters(query)

    def build_filtered_queryset(self, query, **kwargs):
        self._force_exact = len(query) <= 3
        qs = super().build_filtered_queryset(query, **kwargs)
        if len(query) <= 3 and not len(qs):
            # Not exact match, let's fallback to normal "startswith" query
            self._force_exact = False
            qs = super().build_filtered_queryset(query, **kwargs)
        return qs
