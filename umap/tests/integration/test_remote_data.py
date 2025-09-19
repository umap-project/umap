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
                    "properties": {"name": "Point 2"},
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
                    "properties": {"name": "Point 1"},
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
    page.on("request", lambda *a, **k: print(a, k))


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

    expect(page.get_by_role("tooltip", name="Point 1")).to_be_visible()

    # Now drag the map
    map_el = page.locator("#map")
    map_el.drag_to(
        map_el,
        source_position={"x": 100, "y": 100},
        target_position={"x": 110, "y": 110},
    )

    expect(page.get_by_role("tooltip", name="Point 2")).to_be_visible()
    # Needed otherwise it found two (!) tooltip with name "Point 1"…
    page.wait_for_timeout(300)
    expect(page.get_by_role("tooltip", name="Point 1")).to_be_hidden()

    # Map must not be dirty
    page.get_by_role("button", name="Edit").click()
    expect(page.locator(".edit-undo")).to_be_disabled()


def test_create_remote_data_layer(page, live_server, tilelayer, settings):
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
    # with page.expect_response(re.compile("https://remote.org/data.json")):
    page.get_by_role("button", name="Verify remote URL").click()
    expect(page.locator(".leaflet-marker-icon")).to_have_count(1)
    with page.expect_response(re.compile(".*/datalayer/create/.*")):
        page.get_by_role("button", name="Save draft", exact=True).click()
    datalayer = DataLayer.objects.last()
    data = json.loads(Path(datalayer.geojson.path).read_text())
    assert data == {
        "_umap_options": {
            "browsable": True,
            "displayOnLoad": True,
            "editMode": "advanced",
            "fields": [
                {
                    "key": "name",
                    "type": "String",
                },
                {
                    "key": "description",
                    "type": "Text",
                },
            ],
            "id": str(datalayer.pk),
            "inCaption": True,
            "name": "Layer 1",
            "rank": 0,
            "remoteData": {
                "format": "geojson",
                "url": "https://remote.org/data.json",
            },
        },
        "features": [],
        "type": "FeatureCollection",
    }
