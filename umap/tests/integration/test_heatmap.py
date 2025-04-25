import json
from pathlib import Path

import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


def test_heatmap(map, live_server, page):
    path = Path(__file__).parent.parent / "fixtures/heatmap_data.json"
    data = json.loads(path.read_text())
    DataLayerFactory(data=data, map=map)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.locator("canvas.leaflet-heatmap-layer")).to_be_visible()


def test_can_create_heatmap_after_import(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new")
    page.get_by_title("Import data").click()
    file_input = page.locator("input[type='file']")
    with page.expect_file_chooser() as fc_info:
        file_input.click()
    file_chooser = fc_info.value
    path = Path(__file__).parent.parent / "fixtures/heatmap_data.json"
    file_chooser.set_files(path)
    page.get_by_role("button", name="Import data", exact=True).click()
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Edit", exact=True).click()
    page.get_by_role("combobox").select_option("Heat")
    page.get_by_role("button", name="Save draft").click()
    expect(page.locator("canvas.leaflet-heatmap-layer")).to_be_visible()

    # Test we can delete it and save
    page.get_by_text("Advanced actions").click()
    page.get_by_role("button", name="Delete").click()
    page.get_by_role("button", name="Save draft").click()
    expect(page.locator("canvas.leaflet-heatmap-layer")).to_be_hidden()
