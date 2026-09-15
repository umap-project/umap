import json
from urllib.parse import quote

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.django_db

GEOJSON = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "name": "Niagara Falls",
            },
            "geometry": {
                "type": "Point",
                "coordinates": [-79.04, 43.08],
            },
        }
    ],
}
GEOJSON2 = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "name": "Montmorency Falls",
            },
            "geometry": {
                "type": "Point",
                "coordinates": [-71.14, 46.89],
            },
        }
    ],
}
CSV = "name,latitude,longitude\nNiagara Falls,43.08,-79.04"


def test_map_preview(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/map/")
    # Edit mode is not enabled
    edit_button = page.get_by_role("button", name="Edit")
    expect(edit_button).to_be_visible()


def test_map_preview_can_load_remote_geojson(page, live_server, tilelayer):
    def handle(route):
        route.fulfill(json=GEOJSON)

    # Intercept the route to the proxy
    page.route("*/**/ajax-proxy/**", handle)

    page.goto(f"{live_server.url}/map/?dataUrl=http://some.org/geo.json")
    page.get_by_title("Open browser").click()
    expect(page.locator(".umap-browser .datalayer-counter")).to_have_text("(1)")


def test_map_preview_can_load_multiple_remote_geojson(page, live_server, tilelayer):
    def handle(route):
        if "2" in route.request.url:
            route.fulfill(json=GEOJSON2)
        else:
            route.fulfill(json=GEOJSON)

    # Intercept the route to the proxy
    page.route("*/**/ajax-proxy/**", handle)

    page.goto(
        (
            f"{live_server.url}/map/?"
            "dataUrl=http://some.org/geo.json&dataUrl=http://some.org/geo2.json"
        )
    )
    page.get_by_title("Open browser").click()
    expect(page.locator(".umap-browser .datalayer-counter")).to_have_text(
        ["(1)", "(1)"]
    )


def test_map_preview_can_load_remote_csv(page, live_server, tilelayer):
    def handle(route):
        route.fulfill(body=CSV)

    # Intercept the route to the proxy
    page.route("*/**/ajax-proxy/**", handle)

    page.goto(f"{live_server.url}/map/?dataUrl=http://some.org/geo.csv&dataFormat=csv")
    page.get_by_title("Open browser").click()
    expect(page.locator(".umap-browser .datalayer-counter")).to_have_text("(1)")


def test_map_preview_can_load_geojson_in_querystring(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/map/?data={quote(json.dumps(GEOJSON))}")
    page.get_by_title("Open browser").click()
    expect(page.locator(".umap-browser .datalayer-counter")).to_have_text("(1)")


def test_map_preview_can_load_csv_in_querystring(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/map/?data={quote(CSV)}&dataFormat=csv")
    page.get_by_title("Open browser").click()
    expect(page.locator(".umap-browser .datalayer-counter")).to_have_text("(1)")


def test_map_preview_can_change_styling_from_querystring(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/map/?data={quote(json.dumps(GEOJSON))}&color=DarkRed")
    page.get_by_title("Open browser").click()
    expect(page.locator(".umap-browser .datalayer-counter")).to_have_text("(1)")
    page.locator(".umap-browser .datalayer").first.click()
    expect(page.locator(".umap-browser .feature-color")).to_have_css(
        "background-color", "rgb(139, 0, 0)"
    )


def test_can_open_feature_on_load(page, live_server, tilelayer):
    page.goto(
        f"{live_server.url}/map/?data={quote(json.dumps(GEOJSON))}&feature=Niagara Falls"
    )
    # Popup is open.
    expect(page.get_by_text("Niagara Falls")).to_be_visible()
