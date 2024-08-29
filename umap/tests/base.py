import copy
import json

import factory
from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.core.files.base import ContentFile
from django.urls import reverse

from umap.models import DataLayer, Licence, Map, TileLayer

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
            "metadata": {"color": "DarkCyan", "iconClass": "Ball"},
            "properties": {
                "name": "Here",
                "description": "Da place anonymous again 755",
            },
        }
    ],
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


class MapFactory(factory.django.DjangoModelFactory):
    name = "test map"
    slug = "test-map"
    center = Point(13.447265624999998, 48.94415123418794)
    metadata = factory.Dict(
        {
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
    )

    licence = factory.SubFactory(LicenceFactory)
    owner = factory.SubFactory(UserFactory)

    @classmethod
    def _adjust_kwargs(cls, **kwargs):
        # Make sure there is no persistency
        kwargs["metadata"] = copy.deepcopy(kwargs["metadata"])
        kwargs["metadata"]["name"] = kwargs["name"]
        return kwargs

    class Meta:
        model = Map


class DataLayerFactory(factory.django.DjangoModelFactory):
    map = factory.SubFactory(MapFactory)
    name = "test datalayer"
    description = "test description"
    display_on_load = True
    metadata = factory.Dict({"displayOnLoad": True, "browsable": True, "name": name})

    @classmethod
    def _adjust_kwargs(cls, **kwargs):
        if "data" in kwargs:
            data = copy.deepcopy(kwargs.pop("data"))
        else:
            data = DATALAYER_DATA.copy()
        kwargs["metadata"]["name"] = kwargs["name"]
        data.setdefault("type", "FeatureCollection")
        data.setdefault("features", [])
        kwargs["data"] = ContentFile(json.dumps(data), "foo.json")
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
