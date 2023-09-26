from time import sleep

import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


DATALAYER_DATA = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "one point in france"},
            "geometry": {"type": "Point", "coordinates": [3.339844, 46.920255]},
        },
        {
            "type": "Feature",
            "properties": {"name": "one polygon in greenland"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [-41.3, 71.8],
                        [-43.5, 70.8],
                        [-39.3, 70.9],
                        [-37.7, 72.2],
                        [-41.3, 71.8],
                    ]
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {"name": "one line in new zeland"},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [176.1, -38.6],
                    [172.9, -43.3],
                    [168.3, -45.2],
                ],
            },
        },
    ],
    "_umap_options": {
        "displayOnLoad": True,
        "browsable": True,
        "name": "Calque 1",
    },
}


@pytest.fixture
def bootstrap(map, live_server):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA)


def test_data_browser_should_be_open(live_server, page, bootstrap, map):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    el = page.locator(".umap-browse-data")
    expect(el).to_be_visible()
    expect(page.get_by_text("one point in france")).to_be_visible()
    expect(page.get_by_text("one line in new zeland")).to_be_visible()
    expect(page.get_by_text("one polygon in greenland")).to_be_visible()


def test_data_browser_should_be_filterable(live_server, page, bootstrap, map):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    markers = page.locator(".leaflet-marker-icon")
    expect(markers).to_have_count(1)
    el = page.locator("input[name='filter']")
    expect(el).to_be_visible()
    el.type("poly")
    expect(page.get_by_text("one point in france")).to_be_hidden()
    expect(page.get_by_text("one line in new zeland")).to_be_hidden()
    expect(page.get_by_text("one polygon in greenland")).to_be_visible()
    expect(markers).to_have_count(0)  # Hidden by filter


def test_data_browser_can_show_only_visible_features(live_server, page, bootstrap, map):
    # Zoom on France
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/51.000/2.000")
    el = page.get_by_text("Current map view")
    expect(el).to_be_visible()
    el.click()
    expect(page.get_by_text("one point in france")).to_be_visible()
    expect(page.get_by_text("one line in new zeland")).to_be_hidden()
    expect(page.get_by_text("one polygon in greenland")).to_be_hidden()


def test_data_browser_can_mix_filter_and_bbox(live_server, page, bootstrap, map):
    # Zoom on north west
    page.goto(f"{live_server.url}{map.get_absolute_url()}#4/61.98/-2.68")
    el = page.get_by_text("Current map view")
    expect(el).to_be_visible()
    el.click()
    expect(page.get_by_text("one point in france")).to_be_visible()
    expect(page.get_by_text("one polygon in greenland")).to_be_visible()
    expect(page.get_by_text("one line in new zeland")).to_be_hidden()
    el = page.locator("input[name='filter']")
    expect(el).to_be_visible()
    el.type("poly")
    expect(page.get_by_text("one polygon in greenland")).to_be_visible()
    expect(page.get_by_text("one point in france")).to_be_hidden()
    expect(page.get_by_text("one line in new zeland")).to_be_hidden()


def test_data_browser_bbox_limit_should_be_dynamic(live_server, page, bootstrap, map):
    # Zoom on Europe
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/51.000/2.000")
    el = page.get_by_text("Current map view")
    expect(el).to_be_visible()
    el.click()
    expect(page.get_by_text("one point in france")).to_be_visible()
    expect(page.get_by_text("one line in new zeland")).to_be_hidden()
    expect(page.get_by_text("one polygon in greenland")).to_be_hidden()
    unzoom = page.get_by_role("button", name="Zoom out")
    expect(unzoom).to_be_visible()
    # Unzoom until we see the Greenland
    unzoom.click()
    sleep(0.5)  # Zooming is async
    unzoom.click()
    sleep(0.5)  # Zooming is async
    unzoom.click()
    sleep(0.5)  # Zooming is async
    expect(page.get_by_text("one point in france")).to_be_visible()
    expect(page.get_by_text("one polygon in greenland")).to_be_visible()
    expect(page.get_by_text("one line in new zeland")).to_be_hidden()
