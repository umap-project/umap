import pytest

from .base import TileLayerFactory

pytestmark = pytest.mark.django_db


def test_tilelayer_json():
    tilelayer = TileLayerFactory(
        attribution="Attribution",
        maxZoom=19,
        minZoom=0,
        name="Name",
        rank=1,
        tms=True,
        url_template="http://{s}.x.fr/{z}/{x}/{y}",
    )
    assert tilelayer.json == {
        "attribution": "Attribution",
        "id": tilelayer.id,
        "maxZoom": 19,
        "minZoom": 0,
        "name": "Name",
        "rank": 1,
        "tms": True,
        "url_template": "http://{s}.x.fr/{z}/{x}/{y}",
    }
