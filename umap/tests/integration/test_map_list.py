import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.django_db


def test_should_not_render_any_control(live_server, tilelayer, page, map):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.settings["properties"]["miniMap"] = True
    map.settings["properties"]["captionBar"] = True
    map.save()
    # Make sure those controls are visible in normal view
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.locator(".leaflet-control-minimap")).to_be_visible()
    expect(page.locator(".umap-browser")).to_be_visible()
    expect(page.locator(".umap-caption-bar")).to_be_visible()
    expect(page.locator(".leaflet-control-zoom")).to_be_visible()
    expect(page.locator(".leaflet-control-attribution")).to_be_visible()

    # Now load home page to have the list view
    page.goto(live_server.url)
    map_el = page.locator(".map_fragment")
    expect(map_el).to_be_visible()
    expect(map_el.locator(".leaflet-control-minimap")).to_be_hidden()
    expect(map_el.locator(".umap-browser")).to_be_hidden()
    expect(map_el.locator(".umap-caption-bar")).to_be_hidden()
    expect(map_el.locator(".leaflet-control-zoom")).to_be_hidden()
    expect(map_el.locator(".leaflet-control-attribution")).to_be_hidden()
