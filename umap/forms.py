import json

from django import forms
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.forms.utils import ErrorList
from django.template.defaultfilters import slugify
from django.utils.translation import gettext_lazy as _

from .models import DataLayer, Map, Team

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
        fields = ("edit_status", "editors", "share_status", "owner", "team")


class AnonymousMapPermissionsForm(forms.ModelForm):
    edit_status = forms.ChoiceField(choices=Map.ANONYMOUS_EDIT_STATUS)
    share_status = forms.ChoiceField(choices=Map.ANONYMOUS_SHARE_STATUS)

    class Meta:
        model = Map
        fields = ("edit_status", "share_status")


class DataLayerForm(forms.ModelForm):
    def __init__(self, *args, request=None, **kwargs):
        self.timing_request = request
        self.timing_document = None
        super().__init__(*args, **kwargs)

    def clean(self):
        from .feature_archiving import validate_archive_targets
        from .feature_timing import resolve_timing, timing_for

        cleaned = super().clean()
        layer_settings = cleaned.get("settings")
        defaults = (
            layer_settings.get("timingDefaults")
            if isinstance(layer_settings, dict)
            else None
        )
        if defaults is not None:
            try:
                resolve_timing(defaults)
            except forms.ValidationError as exc:
                self.add_error("settings", exc)
        if (
            self.instance.map_id
            and "geojson" not in self.errors
            and "settings" not in self.errors
        ):
            timings = [
                timing_for(feature)
                for feature in (self.timing_document or {}).get("features", [])
            ]
            timings.append(defaults)
            try:
                validate_archive_targets(
                    self.instance, timings, request=self.timing_request
                )
            except forms.ValidationError as exc:
                self.add_error("settings", exc)
        return cleaned

    def clean_geojson(self):
        from .feature_timing import validate_timing

        uploaded = self.cleaned_data.get("geojson")
        if uploaded and hasattr(uploaded, "chunks"):
            try:
                document = json.load(uploaded)
                validate_timing(document)
                generation = document.get("archiveGeneration", 0)
                if (
                    type(generation) is not int
                    or generation != self.instance.archive_generation
                ):
                    raise forms.ValidationError(_("Invalid GeoJSON or timing options."))
                self.timing_document = document
                if self.instance.pk:
                    expired_ids = set(
                        self.instance.expiredfeature_set.values_list(
                            "feature_id", flat=True
                        )
                    )
                    if any(
                        f.get("id") in expired_ids
                        for f in document.get("features", [])
                        if isinstance(f.get("id"), str)
                    ):
                        raise forms.ValidationError(
                            _(
                                "An automatically deleted feature cannot be restored with the same ID. Reload the layer."
                            )
                        )
            except (ValueError, TypeError, AttributeError) as exc:
                raise forms.ValidationError(
                    _("Invalid GeoJSON or timing options.")
                ) from exc
            finally:
                uploaded.seek(0)
        return uploaded

    class Meta:
        model = DataLayer
        fields = ("geojson", "name", "display_on_load", "rank", "settings", "parent")


class DataLayerPermissionsForm(forms.ModelForm):
    class Meta:
        model = DataLayer
        fields = ("edit_status",)


class AnonymousDataLayerPermissionsForm(forms.ModelForm):
    edit_status = forms.ChoiceField(choices=DataLayer.ANONYMOUS_EDIT_STATUS)

    class Meta:
        model = DataLayer
        fields = ("edit_status",)


class MapSettingsForm(forms.ModelForm):
    def __init__(self, *args, **kwargs):
        super(MapSettingsForm, self).__init__(*args, **kwargs)
        self.fields["slug"].required = False
        self.fields["center"].widget.map_srid = 4326

    def clean_slug(self):
        slug = self.cleaned_data.get("slug", None)
        name = self.cleaned_data.get("name", None)
        if not slug and name:
            # If name is empty, don't do nothing, validation will raise
            # later on the process because name is required
            self.cleaned_data["slug"] = slugify(name) or "map"
            return self.cleaned_data["slug"][:50]
        else:
            return ""

    def clean_center(self):
        if not self.cleaned_data["center"]:
            point = DEFAULT_CENTER
            self.cleaned_data["center"] = point
        return self.cleaned_data["center"]

    class Meta:
        fields = ("settings", "name", "center", "slug", "tags", "is_template")
        model = Map


class UserProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ("username", "first_name", "last_name")


class TeamMembersField(forms.ModelMultipleChoiceField):
    def set_choices(self, choices):
        iterator = self.iterator(self)
        # Override queryset so to expose only selected choices:
        # - we don't want a select with 100000 options
        # - the select values will be used by the autocomplete widget to display
        #   already existing members of the team
        iterator.queryset = choices
        self.choices = iterator


class TeamForm(forms.ModelForm):
    class Meta:
        model = Team
        fields = ["name", "description", "members"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["members"].set_choices(self.initial["members"])
        self.fields["members"].widget.attrs["hidden"] = "hidden"

    members = TeamMembersField(queryset=User.objects.all())
