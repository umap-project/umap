import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


DATALAYER_DATA = {
    "type": "FeatureCollection",
    "_umap_options": {
        "name": "Calque 1",
        "type": "Cluster",
        "cluster": {},
        "browsable": True,
        "inCaption": True,
        "displayOnLoad": True,
    },
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "one point in france"},
            "geometry": {"type": "Point", "coordinates": [3.339844, 46.920255]},
        },
        {
            "type": "Feature",
            "properties": {
                "name": "one another point in france in same position",
                "description": "can you see me ?",
            },
            "geometry": {"type": "Point", "coordinates": [3.339844, 46.920255]},
        },
        {
            "type": "Feature",
            "properties": {
                "name": "again one another point",
                "description": "and me ?",
            },
            "geometry": {"type": "Point", "coordinates": [3.34, 46.1]},
        },
    ],
}


def test_can_open_feature_on_browser_click(live_server, page, map):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#7/46.920/3.340")
    page.get_by_text("one another point in france in same position").click()
    expect(page.get_by_text("can you see me ?")).to_be_visible()
    page.get_by_text("again one another point").click()
    expect(page.get_by_text("and me ?")).to_be_visible()
