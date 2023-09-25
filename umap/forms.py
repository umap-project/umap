from django import forms
from django.contrib.gis.geos import Point
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from django.conf import settings
from django.forms.utils import ErrorList

from .models import Map, DataLayer

DEFAULT_LATITUDE = (
    settings.LEAFLET_LATITUDE if hasattr(settings, "LEAFLET_LATITUDE") else 51
)
DEFAULT_LONGITUDE = (
    settings.LEAFLET_LONGITUDE if hasattr(settings, "LEAFLET_LONGITUDE") else 2
)
DEFAULT_CENTER = Point(DEFAULT_LONGITUDE, DEFAULT_LATITUDE)

User = get_user_model()


class FlatErrorList(ErrorList):
    def __unicode__(self):
        return self.flat()

    def flat(self):
        if not self:
            return ""
        return " — ".join([e for e in self])


class SendLinkForm(forms.Form):
    email = forms.EmailField()


class UpdateMapPermissionsForm(forms.ModelForm):
    class Meta:
        model = Map
        fields = ("edit_status", "editors", "share_status", "owner")


class AnonymousMapPermissionsForm(forms.ModelForm):
    STATUS = (
        (Map.OWNER, _("Only editable with secret edit link")),
        (Map.ANONYMOUS, _("Everyone can edit")),
    )

    edit_status = forms.ChoiceField(choices=STATUS)

    class Meta:
        model = Map
        fields = ("edit_status",)


class DataLayerForm(forms.ModelForm):
    class Meta:
        model = DataLayer
        fields = ("geojson", "name", "display_on_load", "rank", "settings")


class DataLayerPermissionsForm(forms.ModelForm):
    class Meta:
        model = DataLayer
        fields = ("edit_status",)


class AnonymousDataLayerPermissionsForm(forms.ModelForm):
    STATUS = (
        (DataLayer.INHERIT, _("Inherit")),
        (DataLayer.OWNER, _("Only editable with secret edit link")),
        (DataLayer.ANONYMOUS, _("Everyone can edit")),
    )

    edit_status = forms.ChoiceField(choices=STATUS)

    class Meta:
        model = DataLayer
        fields = ("edit_status",)


class UserProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ("username", "first_name", "last_name")
