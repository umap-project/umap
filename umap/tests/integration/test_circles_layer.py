import json
from pathlib import Path

import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


def test_basic_circles_layer(map, live_server, page):
    path = Path(__file__).parent.parent / "fixtures/test_circles_layer.geojson"
    data = json.loads(path.read_text())
    DataLayerFactory(data=data, map=map)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#12/47.2210/-1.5621")
    paths = page.locator("path")
    expect(paths).to_have_count(10)
    # Last arc curve command
    assert (
        page.locator("[data-feature=c1160]")
        .get_attribute("d")
        .endswith("a40,40 0 1,0 -80,0 ")
    )
    assert (
        page.locator("[data-feature=ca676]")
        .get_attribute("d")
        .endswith("a31,31 0 1,0 -62,0 ")
    )
    assert (
        page.locator("[data-feature=cap64]")
        .get_attribute("d")
        .endswith("a10,10 0 1,0 -20,0 ")
    )
    assert (
        page.locator("[data-feature=cap27]")
        .get_attribute("d")
        .endswith("a6,6 0 1,0 -12,0 ")
    )
    assert (
        page.locator("[data-feature=capa8]")
        .get_attribute("d")
        .endswith("a4,4 0 1,0 -8,0 ")
    )
    assert (
        page.locator("[data-feature=capa6]")
        .get_attribute("d")
        .endswith("a3,3 0 1,0 -6,0 ")
    )
    assert (
        page.locator("[data-feature=capa4]")
        .get_attribute("d")
        .endswith("a3,3 0 1,0 -6,0 ")
    )
    assert (
        page.locator("[data-feature=capa3]")
        .get_attribute("d")
        .endswith("a2,2 0 1,0 -4,0 ")
    )
    assert (
        page.locator("[data-feature=capa2]")
        .get_attribute("d")
        .endswith("a2,2 0 1,0 -4,0 ")
    )
    assert (
        page.locator("[data-feature=capa0]")
        .get_attribute("d")
        .endswith("a2,2 0 1,0 -4,0 ")
    )


def test_can_set_circles_to_new_imported_data(tilelayer, live_server, page):
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
    expect(page.locator("path")).to_have_count(10)
    expect(page.locator('path[d*="a50,50"]')).to_have_count(0)
    page.locator('select[name="property"]').select_option("capacity")
    expect(page.locator('path[d*="a50,50"]')).to_have_count(1)


def test_can_draw_new_circles(openmap, live_server, page):
    path = Path(__file__).parent.parent / "fixtures/test_circles_layer.geojson"
    data = json.loads(path.read_text())
    DataLayerFactory(data=data, map=openmap)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#12/47.2210/-1.5621")
    paths = page.locator("path")
    expect(paths).to_have_count(10)
    page.get_by_title("Draw a marker").click()
    page.locator("#map").click(position={"x": 200, "y": 200})
    expect(paths).to_have_count(11)
