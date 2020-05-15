import json

import factory
from django.contrib.auth import get_user_model
from django.urls import reverse

from umap.forms import DEFAULT_CENTER
from umap.models import DataLayer, Licence, Map, TileLayer

User = get_user_model()


class LicenceFactory(factory.DjangoModelFactory):
    name = "WTFPL"

    class Meta:
        model = Licence


class TileLayerFactory(factory.DjangoModelFactory):
    name = "Test zoom layer"
    url_template = "http://{s}.test.org/{z}/{x}/{y}.png"
    attribution = "Test layer attribution"

    class Meta:
        model = TileLayer


class UserFactory(factory.DjangoModelFactory):
    username = 'Joe'
    email = factory.LazyAttribute(
        lambda a: '{0}@example.com'.format(a.username).lower())
    password = factory.PostGenerationMethodCall('set_password', '123123')

    class Meta:
        model = User


class MapFactory(factory.DjangoModelFactory):
    name = "test map"
    slug = "test-map"
    center = DEFAULT_CENTER
    settings = {
        'geometry': {
            'coordinates': [13.447265624999998, 48.94415123418794],
            'type': 'Point'
        },
        'properties': {
            'datalayersControl': True,
            'description': 'Which is just the Danube, at the end',
            'displayCaptionOnLoad': False,
            'displayDataBrowserOnLoad': False,
            'displayPopupFooter': False,
            'licence': '',
            'miniMap': False,
            'moreControl': True,
            'name': 'Cruising on the Donau',
            'scaleControl': True,
            'tilelayer': {
                'attribution': u'\xa9 OSM Contributors',
                'maxZoom': 18,
                'minZoom': 0,
                'url_template': 'http://{s}.osm.fr/{z}/{x}/{y}.png'
            },
            'tilelayersControl': True,
            'zoom': 7,
            'zoomControl': True
        },
        'type': 'Feature'
    }

    licence = factory.SubFactory(LicenceFactory)
    owner = factory.SubFactory(UserFactory)

    class Meta:
        model = Map


class DataLayerFactory(factory.DjangoModelFactory):
    map = factory.SubFactory(MapFactory)
    name = "test datalayer"
    description = "test description"
    display_on_load = True
    geojson = factory.django.FileField(data="""{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Point","coordinates":[13.68896484375,48.55297816440071]},"properties":{"_umap_options":{"color":"DarkCyan","iconClass":"Ball"},"name":"Here","description":"Da place anonymous again 755"}}],"_umap_options":{"displayOnLoad":true,"name":"Donau","id":926}}""")  # noqa

    class Meta:
        model = DataLayer


def login_required(response):
    assert response.status_code == 200
    j = json.loads(response.content.decode())
    assert 'login_required' in j
    redirect_url = reverse('login')
    assert j['login_required'] == redirect_url
    return True
