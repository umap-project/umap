import re
from copy import deepcopy

import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db

CENTER = [14.6889, 48.5529, 241]
# In pixels.
XY = {"x": 640, "y": 345}

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
                "coordinates": CENTER,
            },
        },
    ],
}


@pytest.fixture
def bootstrap(centered_map, live_server):
    DataLayerFactory(map=centered_map, data=DATALAYER_DATA)


@pytest.fixture
def centered_map(map):
    # Center the map on the marker so a click at the map hits its icon.
    map.settings["geometry"] = {
        "type": "Point",
        "coordinates": CENTER,
    }
    map.save()
    return map


def test_should_open_popup_on_click(live_server, map, page, bootstrap, wait_for_loaded):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    wait_for_loaded(page)
    expect(page.locator(".umap-popup")).to_be_hidden()
    page.locator("#map").click(position=XY)
    expect(page.locator(".umap-popup")).to_be_visible()
    expect(page.get_by_role("heading", name="test marker")).to_be_visible()
    expect(page.get_by_text("Some description")).to_be_visible()
    # Close popup, clicking on the map, but outside of the popup.
    page.locator("#map").click(position={"x": 50, "y": 50})
    expect(page.locator(".umap-popup")).to_be_hidden()


def test_should_handle_locale_var_in_description(
    live_server, centered_map, page, wait_for_loaded
):
    data = deepcopy(DATALAYER_DATA)
    data["features"][0]["properties"]["description"] = (
        "this is a link to [[https://domain.org/?locale={locale}|Wikipedia]]"
    )
    DataLayerFactory(map=centered_map, data=data)
    page.goto(f"{live_server.url}{centered_map.get_absolute_url()}")
    wait_for_loaded(page)
    page.locator("#map").click(position=XY)
    link = page.get_by_role("link", name="Wikipedia")
    expect(link).to_be_visible()
    expect(link).to_have_attribute("href", "https://domain.org/?locale=en")


def test_should_use_custom_label_key_in_popup_default_template(
    live_server, centered_map, page, wait_for_loaded
):
    data = deepcopy(DATALAYER_DATA)
    data["features"][0]["properties"] = {
        "libellé": "my custom label",
    }
    data["properties"] = {"labelKey": "libellé"}
    DataLayerFactory(map=centered_map, data=data)
    page.goto(f"{live_server.url}{centered_map.get_absolute_url()}")
    wait_for_loaded(page)
    page.locator("#map").click(position=XY)
    expect(page.locator(".umap-popup h4")).to_have_text("my custom label")


def test_should_open_popup_panel_on_click(
    live_server, map, page, bootstrap, wait_for_loaded
):
    map.settings["properties"]["popupShape"] = "Panel"
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    wait_for_loaded(page)
    panel = page.locator(".panel.left.on")
    expect(panel).to_be_hidden()
    page.locator("#map").click(position=XY)
    expect(panel).to_be_visible()
    expect(panel).to_have_class(re.compile(".*expanded.*"))
    expect(panel.get_by_role("heading", name="test marker")).to_be_visible()
    expect(panel.get_by_text("Some description")).to_be_visible()
    # Close the panel popup by clicking the map on an empty area (right side,
    # away from the panel on the left and the marker at the center).
    page.locator("#map").click(position={"x": 1000, "y": 400})
    expect(panel).to_be_hidden()


def test_extended_properties_in_popup(
    live_server, map, page, bootstrap, wait_for_loaded
):
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
    wait_for_loaded(page)
    page.locator("#map").click(position=XY)
    expect(page.locator(".umap-popup")).to_be_visible()
    expect(page.get_by_text("Rank: 1")).to_be_visible()
    expect(page.get_by_text("Locale: en")).to_be_visible()
    expect(page.get_by_text("Lang: en")).to_be_visible()
    expect(page.get_by_text("Lat: 48.5529")).to_be_visible()
    expect(page.get_by_text("Lon: 14.6889")).to_be_visible()
    expect(page.get_by_text("Alt: 241")).to_be_visible()
    expect(page.get_by_text("Zoom: 7")).to_be_visible()
    expect(page.get_by_text("Layer: test datalayer")).to_be_visible()


def test_should_display_tooltip_on_hover(
    live_server, map, page, bootstrap, wait_for_loaded
):
    # Hover mode (showLabel=None): the label is a DOM tooltip, shown on hover.
    map.settings["properties"]["showLabel"] = None
    map.settings["properties"]["labelKey"] = "Foo {name}"
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    wait_for_loaded(page)
    expect(page.get_by_text("Foo test marker")).to_be_hidden()
    # Hover the marker icon (canvas hit-detection at the map center).
    page.locator("#map").hover(position={"x": 640, "y": 345})
    expect(page.get_by_text("Foo test marker")).to_be_visible()
