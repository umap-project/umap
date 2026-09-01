import json
from pathlib import Path

import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


def test_basic_circles_layer(map, live_server, page, assert_screenshot):
    path = Path(__file__).parent.parent / "fixtures/test_circles_layer.geojson"
    data = json.loads(path.read_text())
    DataLayerFactory(data=data, map=map)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#12/47.2210/-1.5621")
    assert_screenshot(page, "circles", ui=False)


def test_can_set_circles_to_new_imported_data(
    tilelayer, live_server, page, assert_screenshot
):
    path = Path(__file__).parent.parent / "fixtures/test_circles_layer.geojson"
    data = json.loads(path.read_text())
    # Fresh geojson, without the circle settings
    import_data = {"type": "FeatureCollection", "features": data["features"]}
    page.goto(f"{live_server.url}/map/new/#12/47.2210/-1.5621")
    page.get_by_title("Import data").click()
    page.wait_for_timeout(300)
    page.locator(".umap-import textarea").fill(json.dumps(import_data))
    page.locator('select[name="format"]').select_option("geojson")
    page.get_by_role("button", name="Import data", exact=True).click()

    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit", exact=True).click()
    page.locator('select[name="type"]').select_option("Circles")
    assert_screenshot(page, "default", ui=False)
    page.locator('select[name="property"]').select_option("capacity")
    assert_screenshot(page, "capacity", ui=False)


def test_can_draw_new_circles(openmap, live_server, page, assert_screenshot):
    path = Path(__file__).parent.parent / "fixtures/test_circles_layer.geojson"
    data = json.loads(path.read_text())
    DataLayerFactory(data=data, map=openmap)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#12/47.2210/-1.5621")
    assert_screenshot(page, "before", ui=False)
    page.get_by_title("Draw a marker").click()
    page.locator("#map").click(position={"x": 200, "y": 200})
    assert_screenshot(page, "after", ui=False)
