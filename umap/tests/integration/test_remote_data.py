import json
import re
from pathlib import Path

from playwright.sync_api import expect

from umap.models import DataLayer, Map

from ..base import DataLayerFactory


def intercept_remote_data(page):
    data = [
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"name": "Point 2", "foobar": "bla"},
                    "geometry": {
                        "type": "Point",
                        "coordinates": [4.3375, 11.2707],
                    },
                }
            ],
        },
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"name": "Point 1", "foobar": "baz"},
                    "geometry": {
                        "type": "Point",
                        "coordinates": [4.3375, 12.2707],
                    },
                }
            ],
        },
    ]

    def handle(route):
        route.fulfill(json=data.pop())

    # Intercept the route to the proxy
    page.route("https://remote.org/data.json", handle)


def test_dynamic_remote_data(page, live_server, tilelayer, map):
    intercept_remote_data(page)
    settings = {
        "remoteData": {
            "url": "https://remote.org/data.json",
            "format": "geojson",
            "dynamic": True,
        },
        "showLabel": True,
    }
    DataLayerFactory(map=map, settings=settings)
    map.edit_status = Map.ANONYMOUS
    map.settings["properties"]["zoom"] = 6
    map.settings["geometry"] = {
        "type": "Point",
        "coordinates": [5, 12],
    }
    map.save()

    page.goto(f"{live_server.url}{map.get_absolute_url()}")

    layers = page.locator(".umap-browser .datalayer")
    title = page.locator(".umap-browser .feature-title")
    page.get_by_title("Open browser").click()
    expect(page.locator(".umap-browser .datalayer-counter")).to_have_text("(1)")
    layers.first.click()
    expect(title).to_have_text("Point 1")
    # Close it to free the map area for the drag.
    page.locator(".panel.left").get_by_title("Close").click()

    # Simulate a drag that OL understands.
    box = page.locator("#map").bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    with page.expect_response(re.compile(r"remote\.org/data\.json")):
        page.mouse.move(cx, cy)
        page.mouse.down()
        page.mouse.move(cx - 60, cy - 60, steps=10)
        page.mouse.up()

    page.get_by_title("Open browser").click()
    expect(page.locator(".umap-browser .datalayer-counter")).to_have_text("(1)")
    layers.first.click()
    expect(title).to_have_text("Point 2")

    # Map must not be dirty
    page.get_by_role("button", name="Edit").click()
    expect(page.locator(".edit-undo")).to_be_disabled()


def test_create_remote_data_layer(
    page, live_server, tilelayer, settings, assert_screenshot
):
    settings.UMAP_ALLOW_ANONYMOUS = True
    intercept_remote_data(page)
    page.goto(f"{live_server.url}/en/map/new#6/11.2707/4.3375")
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Add a layer").click()
    page.get_by_text("Remote data").click()
    page.locator('.panel input[name="url"]').fill("https://remote.org/data.json")
    # We have a setTimeout on each input to throttle, so wait for it
    page.wait_for_timeout(300)
    page.locator('select[name="format"]').select_option("geojson")
    page.get_by_role("button", name="Verify remote URL").click()
    # The icon is drawn on the canvas; check the loaded feature via the browser.
    page.get_by_title("Open browser").click()
    expect(page.locator(".umap-browser .datalayer-counter")).to_have_text("(1)")

    # Visual check that the marker is actually drawn on the canvas.
    page.get_by_title("zoom to data extent").click()
    page.locator(".panel.left").get_by_title("Close").click()
    assert_screenshot(
        page, suffix="marker", clip={"x": 560, "y": 260, "width": 160, "height": 200}
    )

    with page.expect_response(re.compile(".*/datalayer/create/.*")):
        page.get_by_role("button", name="Save draft", exact=True).click()
    assert DataLayer.objects.count() == 1
    datalayer = DataLayer.objects.last()
    data = json.loads(Path(datalayer.geojson.path).read_text())
    assert data == {
        "properties": {
            "browsable": True,
            "displayOnLoad": True,
            "fields": [
                {
                    "key": "name",
                    "type": "String",
                },
                {
                    "key": "foobar",
                    "type": "String",
                },
            ],
            "inCaption": True,
            "name": "Layer 1",
            "remoteData": {
                "format": "geojson",
                "url": "https://remote.org/data.json",
            },
        },
        "rank": 0,
        "id": str(datalayer.pk),
        "features": [],
        "type": "FeatureCollection",
    }
