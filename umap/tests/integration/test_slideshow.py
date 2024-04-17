import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


DATALAYER_DATA = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [13.6, 48.5],
            },
            "properties": {"name": "1st Point"},
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [13.7, 48.4],
            },
            "properties": {"name": "2d Point"},
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [13.5, 48.6],
            },
            "properties": {"name": "3d Point"},
        },
    ],
}


def test_can_use_slideshow_manually(map, live_server, page):
    map.settings["properties"]["slideshow"] = {"active": True, "delay": 5000}
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    first_point = page.get_by_text("1st Point")
    second_point = page.get_by_text("2d Point")
    third_point = page.get_by_text("3d Point")
    expect(first_point).to_be_hidden()
    expect(second_point).to_be_hidden()
    expect(third_point).to_be_hidden()
    next_ = page.get_by_title("Zoom to the next")
    expect(next_).to_be_visible()
    next_.click()
    expect(first_point).to_be_visible()
    next_.click()
    expect(first_point).to_be_hidden()
    expect(second_point).to_be_visible()
    next_.click()
    expect(first_point).to_be_hidden()
    expect(second_point).to_be_hidden()
    expect(third_point).to_be_visible()
    next_.click()
    expect(first_point).to_be_visible()
    expect(second_point).to_be_hidden()
    expect(third_point).to_be_hidden()
