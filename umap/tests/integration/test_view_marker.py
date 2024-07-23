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
            "properties": {
                "name": "test marker",
                "description": "Some description",
            },
            "geometry": {
                "type": "Point",
                "coordinates": [14.6889, 48.5529, 241],
            },
        },
    ],
}


@pytest.fixture
def bootstrap(map, live_server):
    DataLayerFactory(map=map, data=DATALAYER_DATA)


def test_should_open_popup_on_click(live_server, map, page, bootstrap):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.locator(".umap-icon-active")).to_be_hidden()
    page.locator(".leaflet-marker-icon").click()
    expect(page.locator(".umap-icon-active")).to_be_visible()
    expect(page.locator(".leaflet-popup-content-wrapper")).to_be_visible()
    expect(page.get_by_role("heading", name="test marker")).to_be_visible()
    expect(page.get_by_text("Some description")).to_be_visible()
    # Close popup, clicking on the map, but outside of the popup.
    page.locator("#map").click(position={"x": 50, "y": 50})
    expect(page.locator(".umap-icon-active")).to_be_hidden()


def test_should_handle_locale_var_in_description(live_server, map, page):
    data = deepcopy(DATALAYER_DATA)
    data["features"][0]["properties"]["description"] = (
        "this is a link to [[https://domain.org/?locale={locale}|Wikipedia]]"
    )
    DataLayerFactory(map=map, data=data)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    page.locator(".leaflet-marker-icon").click()
    link = page.get_by_role("link", name="Wikipedia")
    expect(link).to_be_visible()
    expect(link).to_have_attribute("href", "https://domain.org/?locale=en")


def test_should_display_tooltip_with_variable(live_server, map, page, bootstrap):
    map.settings["properties"]["showLabel"] = True
    map.settings["properties"]["labelKey"] = "Foo {name}"
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.get_by_text("Foo test marker")).to_be_visible()


def test_should_open_popup_panel_on_click(live_server, map, page, bootstrap):
    map.settings["properties"]["popupShape"] = "Panel"
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    panel = page.locator(".panel.left.on")
    expect(panel).to_be_hidden()
    page.locator(".leaflet-marker-icon").click()
    expect(panel).to_be_visible()
    expect(panel).to_have_class(re.compile(".*expanded.*"))
    expect(panel.get_by_role("heading", name="test marker")).to_be_visible()
    expect(panel.get_by_text("Some description")).to_be_visible()
    # Close popup
    page.locator("#map").click()
    expect(panel).to_be_hidden()


def test_extended_properties_in_popup(live_server, map, page, bootstrap):
    map.settings["properties"]["popupContentTemplate"] = """
    Rank: {rank}
    Locale: {locale}
    Lang: {lang}
    Lat: {lat}
    Lon: {lon}
    Alt: {alt}
    Zoom: {zoom}
    Layer: {layer}
    """
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.locator(".umap-icon-active")).to_be_hidden()
    page.locator(".leaflet-marker-icon").click()
    expect(page.locator(".umap-icon-active")).to_be_visible()
    expect(page.locator(".leaflet-popup-content-wrapper")).to_be_visible()
    expect(page.get_by_text("Rank: 1")).to_be_visible()
    expect(page.get_by_text("Locale: en")).to_be_visible()
    expect(page.get_by_text("Lang: en")).to_be_visible()
    expect(page.get_by_text("Lat: 48.5529")).to_be_visible()
    expect(page.get_by_text("Lon: 14.6889")).to_be_visible()
    expect(page.get_by_text("Alt: 241")).to_be_visible()
    expect(page.get_by_text("Zoom: 7")).to_be_visible()
    expect(page.get_by_text("Layer: test datalayer")).to_be_visible()
