from django.contrib.gis.geos import Point
from django.template.defaultfilters import slugify
from django.conf import settings
from rest_framework import serializers

from .models import Map

DEFAULT_LATITUDE = (
    settings.LEAFLET_LATITUDE if hasattr(settings, "LEAFLET_LATITUDE") else 51
)
DEFAULT_LONGITUDE = (
    settings.LEAFLET_LONGITUDE if hasattr(settings, "LEAFLET_LONGITUDE") else 2
)
DEFAULT_CENTER = Point(DEFAULT_LONGITUDE, DEFAULT_LATITUDE)


class MapSerializer(serializers.HyperlinkedModelSerializer):
    slug = serializers.CharField(required=False)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = Map
        fields = ["id", "name", "slug", "center", "settings", "permissions"]

    def get_permissions(self, obj):
        permissions = {}
        permissions["edit_status"] = obj.edit_status
        permissions["share_status"] = obj.share_status
        if obj.owner:
            permissions["owner"] = {
                "id": obj.owner.pk,
                "name": str(obj.owner),
                "url": obj.owner.get_url(),
            }
            permissions["editors"] = [
                {"id": editor.pk, "name": str(editor)} for editor in obj.editors.all()
            ]
        return permissions

    def validate(self, data):
        slug = data.get("slug")
        name = data.get("name")
        if not slug and name:
            data["slug"] = slugify(name)[:50] or "map"
        return data

    def validate_center(self, value):
        return value or DEFAULT_CENTER
