import json
from pathlib import Path

import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


def test_basic_categorized_map_with_default_color(
    map, live_server, page, assert_screenshot
):
    path = Path(__file__).parent.parent / "fixtures/categorized_highway.geojson"
    data = json.loads(path.read_text())
    DataLayerFactory(data=data, map=map)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#13/48.4378/3.3043")
    assert_screenshot(page, "categorized", ui=False)


def test_basic_categorized_map_with_custom_brewer(
    openmap, live_server, page, assert_screenshot
):
    path = Path(__file__).parent.parent / "fixtures/categorized_highway.geojson"
    data = json.loads(path.read_text())

    # Change brewer at load
    data["properties"]["categorized"]["brewer"] = "Spectral"
    DataLayerFactory(data=data, map=openmap)

    page.goto(f"{live_server.url}{openmap.get_absolute_url()}#13/48.4378/3.3043")
    assert_screenshot(page, "spectral", ui=False)

    # Now change brewer from UI
    page.get_by_role("button", name="Edit", exact=True).click()
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit", exact=True).click()
    page.get_by_text("Categorized: settings").click()
    page.locator('select[name="brewer"]').select_option("Paired")

    assert_screenshot(page, "paired", ui=False)


def test_basic_categorized_map_with_custom_categories(
    openmap, live_server, page, assert_screenshot
):
    path = Path(__file__).parent.parent / "fixtures/categorized_highway.geojson"
    data = json.loads(path.read_text())

    # Change categories at load
    data["properties"]["categorized"]["categories"] = (
        "unclassified,track,service,residential,tertiary,secondary"
    )
    data["properties"]["categorized"]["mode"] = "manual"
    DataLayerFactory(data=data, map=openmap)

    page.goto(f"{live_server.url}{openmap.get_absolute_url()}#13/48.4378/3.3043")

    assert_screenshot(page, "manual1", ui=False)

    # Now change categories from UI
    page.get_by_role("button", name="Edit", exact=True).click()
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit", exact=True).click()
    page.get_by_text("Categorized: settings").click()
    page.locator('input[name="categories"]').fill(
        "secondary,tertiary,residential,service,track,unclassified"
    )
    page.locator('input[name="categories"]').blur()

    assert_screenshot(page, "manual2", ui=False)

    # Now go back to automatic categories
    page.get_by_text("Alphabetical").click()

    assert_screenshot(page, "automatic", ui=False)
