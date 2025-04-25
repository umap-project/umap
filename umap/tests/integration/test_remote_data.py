from playwright.sync_api import expect

from umap.models import Map

from ..base import DataLayerFactory


def test_dynamic_remote_data(page, live_server, tilelayer, map):
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

    # Intercept the route to the proxy
    page.route("https://remote.org/data.json", handle)
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
