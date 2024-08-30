import copy
import json

import factory
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.urls import reverse

from umap.forms import DEFAULT_CENTER
from umap.models import DataLayer, Licence, Map, Team, TileLayer

User = get_user_model()

DATALAYER_DATA = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [14.68896484375, 48.55297816440071],
            },
            "properties": {
                "_umap_options": {"color": "DarkCyan", "iconClass": "Ball"},
                "name": "Here",
                "description": "Da place anonymous again 755",
            },
        }
    ],
    "_umap_options": {"displayOnLoad": True, "name": "Donau", "id": 926},
}


class LicenceFactory(factory.django.DjangoModelFactory):
    name = "WTFPL"

    class Meta:
        model = Licence


class TileLayerFactory(factory.django.DjangoModelFactory):
    name = "Test zoom layer"
    url_template = "http://{s}.test.org/{z}/{x}/{y}.png"
    attribution = "Test layer attribution"

    class Meta:
        model = TileLayer


class UserFactory(factory.django.DjangoModelFactory):
    username = "Joe"
    email = factory.LazyAttribute(
        lambda a: "{0}@example.com".format(a.username).lower()
    )
    password = factory.PostGenerationMethodCall("set_password", "123123")

    class Meta:
        model = User


class TeamFactory(factory.django.DjangoModelFactory):
    name = "Awesome Team"

    class Meta:
        model = Team


class MapFactory(factory.django.DjangoModelFactory):
    name = "test map"
    slug = "test-map"
    center = DEFAULT_CENTER
    settings = factory.Dict(
        {
            "geometry": {
                "coordinates": [13.447265624999998, 48.94415123418794],
                "type": "Point",
            },
            "properties": {
                "datalayersControl": True,
                "description": "Which is just the Danube, at the end",
                "displayPopupFooter": False,
                "licence": "",
                "miniMap": False,
                "moreControl": True,
                "name": name,
                "scaleControl": True,
                "tilelayer": {
                    "attribution": "\xa9 OSM Contributors",
                    "maxZoom": 18,
                    "minZoom": 0,
                    "url_template": "https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
                },
                "tilelayersControl": True,
                "zoom": 7,
                "zoomControl": True,
            },
            "type": "Feature",
        }
    )

    licence = factory.SubFactory(LicenceFactory)
    owner = factory.SubFactory(UserFactory)

    @classmethod
    def _adjust_kwargs(cls, **kwargs):
        # Make sure there is no persistency
        kwargs["settings"] = copy.deepcopy(kwargs["settings"])
        kwargs["settings"]["properties"]["name"] = kwargs["name"]
        return kwargs

    class Meta:
        model = Map


class DataLayerFactory(factory.django.DjangoModelFactory):
    map = factory.SubFactory(MapFactory)
    name = "test datalayer"
    description = "test description"
    display_on_load = True
    settings = factory.Dict({"displayOnLoad": True, "browsable": True, "name": name})

    @classmethod
    def _adjust_kwargs(cls, **kwargs):
        if "data" in kwargs:
            data = copy.deepcopy(kwargs.pop("data"))
            if "settings" not in kwargs:
                kwargs["settings"] = data.get("_umap_options", {})
        else:
            data = DATALAYER_DATA.copy()
            data["_umap_options"] = {
                **DataLayerFactory.settings._defaults,
                **kwargs["settings"],
            }
        data.setdefault("_umap_options", {})
        kwargs["settings"]["name"] = kwargs["name"]
        data["_umap_options"]["name"] = kwargs["name"]
        data.setdefault("type", "FeatureCollection")
        data.setdefault("features", [])
        kwargs["geojson"] = ContentFile(json.dumps(data), "foo.json")
        return kwargs

    class Meta:
        model = DataLayer


def login_required(response):
    assert response.status_code == 200
    j = json.loads(response.content.decode())
    assert "login_required" in j
    redirect_url = reverse("login")
    assert j["login_required"] == redirect_url
    return True
