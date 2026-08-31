import json
from pathlib import Path

import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


def test_basic_choropleth_map_with_default_color(
    map, live_server, page, assert_screenshot
):
    path = Path(__file__).parent.parent / "fixtures/choropleth_region_chomage.geojson"
    data = json.loads(path.read_text())
    DataLayerFactory(data=data, map=map)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/46/1.964424")
    assert_screenshot(page, "choropleth", ui=False)


def test_basic_choropleth_map_with_custom_brewer(
    openmap, live_server, page, assert_screenshot
):
    path = Path(__file__).parent.parent / "fixtures/choropleth_region_chomage.geojson"
    data = json.loads(path.read_text())

    # Change brewer at load
    data["properties"]["choropleth"]["brewer"] = "Reds"
    DataLayerFactory(data=data, map=openmap)

    page.goto(f"{live_server.url}{openmap.get_absolute_url()}#6/46/1.964424")
    assert_screenshot(page, "reds", ui=False)

    # Now change brewer from UI
    page.get_by_role("button", name="Edit").click()
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit", exact=True).click()
    page.get_by_text("Choropleth: settings").click()
    page.locator('select[name="brewer"]').select_option("Greens")

    assert_screenshot(page, "greens", ui=False)


def test_basic_choropleth_map_with_custom_classes(
    openmap, live_server, page, assert_screenshot
):
    path = Path(__file__).parent.parent / "fixtures/choropleth_region_chomage.geojson"
    data = json.loads(path.read_text())

    # Change brewer at load
    data["properties"]["choropleth"]["classes"] = 6
    DataLayerFactory(data=data, map=openmap)

    page.goto(f"{live_server.url}{openmap.get_absolute_url()}#6/46/1.964424")
    assert_screenshot(page, "custom", ui=False)
