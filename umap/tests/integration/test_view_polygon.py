import re
from copy import deepcopy

import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db

DATALAYER_DATA = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "name poly", "description": "poly description"},
            "id": "gyNzM",
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [11.25, 53.585984],
                        [10.151367, 52.975108],
                        [12.689209, 52.167194],
                        [14.084473, 53.199452],
                        [12.634277, 53.618579],
                        [11.25, 53.585984],
                        [11.25, 53.585984],
                    ],
                ],
            },
        },
    ],
}


def test_should_open_popup_on_click(live_server, map, page):
    DataLayerFactory(map=map, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/53.239/8.429")
    polygon = page.locator("path").first
    expect(polygon).to_have_attribute("fill-opacity", "0.3")
    polygon.click()
    expect(page.locator(".leaflet-popup-content-wrapper")).to_be_visible()
    expect(page.get_by_role("heading", name="name poly")).to_be_visible()
    expect(page.get_by_text("poly description")).to_be_visible()
    # It's not a round value
    expect(polygon).to_have_attribute("fill-opacity", re.compile(r"0.5\d+"))
    # Close popup
    page.locator("#map").click()
    expect(polygon).to_have_attribute("fill-opacity", "0.3")


def test_should_not_react_to_click_if_interactive_false(live_server, map, page):
    data = deepcopy(DATALAYER_DATA)
    data["features"][0]["properties"]["_umap_options"] = {"interactive": False}
    DataLayerFactory(map=map, data=data)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/53.239/8.429")
    polygon = page.locator("path").first
    expect(polygon).to_have_css("pointer-events", "none")
