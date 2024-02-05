from pathlib import Path

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.django_db


def test_umap_import_from_file(live_server, datalayer, page):
    page.goto(f"{live_server.url}/map/new/")
    button = page.get_by_title("Import data")
    expect(button).to_be_visible()
    button.click()
    file_input = page.locator("input[type='file']")
    with page.expect_file_chooser() as fc_info:
        file_input.click()
    file_chooser = fc_info.value
    path = Path(__file__).parent.parent / "fixtures/display_on_load.umap"
    file_chooser.set_files(path)
    button = page.get_by_role("button", name="Import", exact=True)
    expect(button).to_be_visible()
    button.click()
    layers = page.locator(".umap-browse-datalayers li")
    expect(layers).to_have_count(2)
    nonloaded = page.locator(".umap-browse-datalayers li.off")
    expect(nonloaded).to_have_count(1)
    assert file_input.input_value()
    # Close the import panel
    page.keyboard.press("Escape")
    assert not file_input.input_value()


def test_umap_import_geojson_from_textarea(live_server, datalayer, page):
    page.goto(f"{live_server.url}/map/new/")
    layers = page.locator(".umap-browse-datalayers li")
    markers = page.locator(".leaflet-marker-icon")
    paths = page.locator("path")
    expect(markers).to_have_count(0)
    expect(paths).to_have_count(0)
    expect(layers).to_have_count(0)
    button = page.get_by_title("Import data")
    expect(button).to_be_visible()
    button.click()
    textarea = page.locator(".umap-upload textarea")
    path = Path(__file__).parent.parent / "fixtures/test_upload_data.json"
    textarea.fill(path.read_text())
    page.locator('select[name="format"]').select_option("geojson")
    button = page.get_by_role("button", name="Import", exact=True)
    expect(button).to_be_visible()
    button.click()
    # A layer has been created
    expect(layers).to_have_count(1)
    expect(markers).to_have_count(2)
    expect(paths).to_have_count(3)
