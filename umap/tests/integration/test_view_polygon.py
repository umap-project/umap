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


def test_should_open_popup_on_click(
    live_server, map, page, wait_for_loaded, assert_screenshot
):
    DataLayerFactory(map=map, data=DATALAYER_DATA)
    # Center on a point inside the polygon so clicking on the map element ends inside.
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/53.09/12.16")
    wait_for_loaded(page)
    # Target the polygon only (not UI buttons & co).
    clip = {"x": 628, "y": 382, "width": 48, "height": 24}
    assert_screenshot(page, suffix="default", clip=clip)
    page.locator("#map").click()
    expect(page.locator(".umap-popup")).to_be_visible()
    expect(page.get_by_role("heading", name="name poly")).to_be_visible()
    expect(page.get_by_text("poly description")).to_be_visible()
    assert_screenshot(page, suffix="highlighted", clip=clip)


def test_should_not_react_to_click_if_interactive_false(
    live_server, map, page, wait_for_loaded
):
    data = deepcopy(DATALAYER_DATA)
    data["features"][0]["properties"]["_umap_options"] = {"interactive": False}
    DataLayerFactory(map=map, data=data)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/53.09/12.16")
    wait_for_loaded(page)
    # Center is on the polygon, but it is not interactive: click must be ignored.
    page.locator("#map").click()
    expect(page.locator(".umap-popup")).to_be_hidden()
