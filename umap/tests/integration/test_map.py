import re

import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


def test_preconnect_for_tilelayer(map, page, live_server, tilelayer):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    meta = page.locator('link[rel="preconnect"]')
    expect(meta).to_have_count(1)
    expect(meta).to_have_attribute("href", "//a.tile.openstreetmap.fr")
    # Add custom tilelayer
    map.settings["properties"]["tilelayer"] = {
        "name": "OSM Piano FR",
        "maxZoom": 20,
        "minZoom": 0,
        "attribution": "test",
        "url_template": "https://a.piano.tiles.quaidorsay.fr/fr{r}/{z}/{x}/{y}.png",
    }
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(meta).to_have_attribute("href", "//a.piano.tiles.quaidorsay.fr")
    # Add custom tilelayer with variable in domain, should create a preconnect
    map.settings["properties"]["tilelayer"] = {
        "name": "OSM Piano FR",
        "maxZoom": 20,
        "minZoom": 0,
        "attribution": "test",
        "url_template": "https://{s}.piano.tiles.quaidorsay.fr/fr{r}/{z}/{x}/{y}.png",
    }
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(meta).to_have_count(0)


def test_default_view_without_datalayer_should_use_default_center(
    map, live_server, datalayer, page
):
    datalayer.settings["displayOnLoad"] = False
    datalayer.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}?onLoadPanel=datalayers")
    # Hash is defined, so map is initialized
    expect(page).to_have_url(re.compile(r".*#7/48\..+/13\..+"))
    layers = page.locator(".umap-browser .datalayer summary")
    expect(layers).to_have_count(1)


def test_default_view_latest_without_datalayer_should_use_default_center(
    map, live_server, datalayer, page
):
    datalayer.settings["displayOnLoad"] = False
    datalayer.save()
    map.settings["properties"]["defaultView"] = "latest"
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}?onLoadPanel=datalayers")
    # Hash is defined, so map is initialized
    expect(page).to_have_url(re.compile(r".*#7/48\..+/13\..+"))
    layers = page.locator(".umap-browser .datalayer summary")
    expect(layers).to_have_count(1)


def test_default_view_data_without_datalayer_should_use_default_center(
    map, live_server, datalayer, page
):
    datalayer.settings["displayOnLoad"] = False
    datalayer.save()
    map.settings["properties"]["defaultView"] = "data"
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}?onLoadPanel=datalayers")
    # Hash is defined, so map is initialized
    expect(page).to_have_url(re.compile(r".*#7/48\..+/13\..+"))
    layers = page.locator(".umap-browser .datalayer summary")
    expect(layers).to_have_count(1)


def test_default_view_latest_with_marker(map, live_server, datalayer, page):
    map.settings["properties"]["defaultView"] = "latest"
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}?onLoadPanel=datalayers")
    # Hash is defined, so map is initialized
    expect(page).to_have_url(re.compile(r".*#7/48\..+/14\..+"))
    layers = page.locator(".umap-browser .datalayer summary")
    expect(layers).to_have_count(1)
    expect(page.locator(".leaflet-popup")).to_be_visible()


def test_default_view_latest_with_line(map, live_server, page):
    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "a line"},
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [2.12, 49.57],
                        [3.19, 48.77],
                        [2.51, 47.55],
                        [1.08, 49.02],
                    ],
                },
            }
        ],
    }
    DataLayerFactory(map=map, data=data)
    map.settings["properties"]["defaultView"] = "latest"
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}?onLoadPanel=datalayers")
    expect(page).to_have_url(re.compile(r".*#8/48\..+/2\..+"))
    layers = page.locator(".umap-browser .datalayer summary")
    expect(layers).to_have_count(1)


def test_default_view_latest_with_polygon(map, live_server, page):
    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "a polygon"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [2.12, 49.57],
                            [1.08, 49.02],
                            [2.51, 47.55],
                            [3.19, 48.77],
                            [2.12, 49.57],
                        ]
                    ],
                },
            }
        ],
    }
    DataLayerFactory(map=map, data=data)
    map.settings["properties"]["defaultView"] = "latest"
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}?onLoadPanel=datalayers")
    expect(page).to_have_url(re.compile(r".*#8/48\..+/2\..+"))
    layers = page.locator(".umap-browser .datalayer summary")
    expect(layers).to_have_count(1)


def test_default_view_locate(browser, live_server, map):
    context = browser.new_context(
        geolocation={"longitude": 8.52967, "latitude": 39.16267},
        permissions=["geolocation"],
    )
    map.settings["properties"]["defaultView"] = "locate"
    map.save()
    page = context.new_page()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page).to_have_url(re.compile(r".*#18/39\.16267/8\.52967"))


def test_remote_layer_should_not_be_used_as_datalayer_for_created_features(
    openmap, live_server, datalayer, page
):
    datalayer.settings["remoteData"] = {
        "url": "https://overpass-api.de/api/interpreter?data=[out:xml];node[harbour=yes]({south},{west},{north},{east});out body;",
        "format": "osm",
        "from": "10",
    }
    datalayer.save()
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    toggle = page.get_by_role("button", name="Open browser")
    expect(toggle).to_be_visible()
    toggle.click()
    layers = page.locator(".umap-browser .datalayer summary")
    expect(layers).to_have_count(1)
    map_el = page.locator("#map")
    add_marker = page.get_by_title("Draw a marker")
    expect(add_marker).to_be_visible()
    marker = page.locator(".leaflet-marker-icon")
    expect(marker).to_have_count(0)
    add_marker.click()
    map_el.click(position={"x": 500, "y": 100})
    expect(marker).to_have_count(1)
    # A new datalayer has been created to host this created feature
    # given the remote one cannot accept new features
    page.get_by_title("Open browser").click()
    expect(layers).to_have_count(2)


def test_minimap_on_load(map, live_server, datalayer, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.locator(".leaflet-control-minimap")).to_be_hidden()
    map.settings["properties"]["miniMap"] = True
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.locator(".leaflet-control-minimap")).to_be_visible()


def test_zoom_control_on_load(map, live_server, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.locator(".leaflet-control-zoom")).to_be_visible()
    map.settings["properties"]["zoomControl"] = False
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.locator(".leaflet-control-zoom")).to_be_hidden()


def test_feature_in_query_string_has_precedence_over_onloadpanel(
    map, live_server, page
):
    map.settings["properties"]["onLoadPanel"] = "caption"
    map.name = "This is my map"
    map.save()
    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "FooBar"},
                "geometry": {
                    "type": "Point",
                    "coordinates": [2.12, 49.57],
                },
            }
        ],
        "_umap_options": {"popupShape": "Panel"},
    }
    DataLayerFactory(map=map, data=data)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?feature=FooBar")
    expect(page.get_by_role("heading", name="FooBar")).to_be_visible()
    expect(page.get_by_role("heading", name="This is my map")).to_be_hidden()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.get_by_role("heading", name="FooBar")).to_be_hidden()
    expect(page.get_by_role("heading", name="This is my map")).to_be_visible()
