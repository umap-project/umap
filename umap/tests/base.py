import json

import factory
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.urls import reverse

from umap.forms import DEFAULT_CENTER
from umap.models import DataLayer, Licence, Map, TileLayer

User = get_user_model()

DATALAYER_DATA = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [13.68896484375, 48.55297816440071],
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


class MapFactory(factory.django.DjangoModelFactory):
    name = "test map"
    slug = "test-map"
    center = DEFAULT_CENTER
    settings = {
        "geometry": {
            "coordinates": [13.447265624999998, 48.94415123418794],
            "type": "Point",
        },
        "properties": {
            "datalayersControl": True,
            "description": "Which is just the Danube, at the end",
            "displayCaptionOnLoad": False,
            "displayDataBrowserOnLoad": False,
            "displayPopupFooter": False,
            "licence": "",
            "miniMap": False,
            "moreControl": True,
            "name": "Cruising on the Donau",
            "scaleControl": True,
            "tilelayer": {
                "attribution": "\xa9 OSM Contributors",
                "maxZoom": 18,
                "minZoom": 0,
                "url_template": "http://{s}.osm.fr/{z}/{x}/{y}.png",
            },
            "tilelayersControl": True,
            "zoom": 7,
            "zoomControl": True,
        },
        "type": "Feature",
    }

    licence = factory.SubFactory(LicenceFactory)
    owner = factory.SubFactory(UserFactory)

    class Meta:
        model = Map


class DataLayerFactory(factory.django.DjangoModelFactory):
    map = factory.SubFactory(MapFactory)
    name = "test datalayer"
    description = "test description"
    display_on_load = True
    settings = {"displayOnLoad": True, "browsable": True, "name": name}
    geojson = factory.django.FileField()

    @factory.post_generation
    def geojson_data(obj, create, extracted, **kwargs):
        # Make sure DB settings and file settings are aligned.
        # At some point, file settings should be removed, but we are not there yet.
        data = DATALAYER_DATA.copy()
        obj.settings["name"] = obj.name
        data["_umap_options"] = obj.settings
        with open(obj.geojson.path, mode="w") as f:
            f.write(json.dumps(data))

    class Meta:
        model = DataLayer


def login_required(response):
    assert response.status_code == 200
    j = json.loads(response.content.decode())
    assert "login_required" in j
    redirect_url = reverse("login")
    assert j["login_required"] == redirect_url
    return True
