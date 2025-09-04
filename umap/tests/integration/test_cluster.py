import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


DATALAYER_DATA = {
    "type": "FeatureCollection",
    "_umap_options": {
        "name": "Calque 1",
        "type": "Cluster",
        "cluster": {},
        "browsable": True,
        "inCaption": True,
        "displayOnLoad": True,
    },
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "one point in france"},
            "geometry": {"type": "Point", "coordinates": [3.339844, 46.920255]},
        },
        {
            "type": "Feature",
            "properties": {
                "name": "one another point in france in same position",
                "description": "can you see me ?",
            },
            "geometry": {"type": "Point", "coordinates": [3.339844, 46.920255]},
        },
        {
            "type": "Feature",
            "properties": {
                "name": "again one another point",
                "description": "and me ?",
            },
            "geometry": {"type": "Point", "coordinates": [3.34, 46.1]},
        },
    ],
}


def test_can_open_feature_on_browser_click(live_server, page, map):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#7/46.920/3.340")
    page.get_by_text("one another point in france in same position").click()
    expect(page.get_by_text("can you see me ?")).to_be_visible()
    page.get_by_text("again one another point").click()
    expect(page.get_by_text("and me ?")).to_be_visible()


def test_can_drag_single_marker_in_cluster_layer(live_server, page, tilelayer, openmap):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#7/46.920/3.340")

    marker = page.locator(".umap-div-icon")
    map = page.locator("#map")

    expect(page.locator(".edit-undo")).to_be_disabled()
    # Drag marker
    old_bbox = marker.bounding_box()
    marker.first.drag_to(map, target_position={"x": 250, "y": 250})
    assert marker.bounding_box() != old_bbox
    expect(page.locator(".edit-undo")).to_be_enabled()
    # Make sure edit stays panel
    page.wait_for_timeout(1000)
    expect(page.locator(".panel.right")).to_be_visible()


def test_can_drag_marker_in_cluster(live_server, page, tilelayer, openmap):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#18/46.92/3.34")

    marker = page.locator(".umap-div-icon")
    cluster = page.locator(".umap-cluster-icon")
    map = page.locator("#map")
    expect(marker).to_have_count(0)

    expect(page.locator(".edit-undo")).to_be_disabled()
    cluster.click()
    marker.first.drag_to(map, target_position={"x": 250, "y": 250})
    expect(page.locator(".edit-undo")).to_be_enabled()
    # There is no more cluster
    expect(marker).to_have_count(2)


def test_can_change_datalayer_of_marker_in_cluster(
    live_server, page, datalayer, openmap, tilelayer
):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    datalayer.settings["iconClass"] = "Ball"
    datalayer.save()
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#7/46.920/3.340")

    expect(page.locator(".umap-ball-icon")).to_have_count(0)
    page.locator(".umap-div-icon").click(modifiers=["Shift"])
    page.get_by_role("combobox").select_option(str(datalayer.pk))
    expect(page.locator(".umap-ball-icon")).to_have_count(1)


def test_can_combine_cluster_with_remote_data_and_fromZoom(
    page, live_server, tilelayer, map
):
    settings = {
        "fromZoom": "7",
        "type": "Cluster",
        "showLabel": True,
        "remoteData": {
            "url": "https://remote.org/data.json",
            "format": "geojson",
            "dynamic": True,
        },
    }
    DataLayerFactory(map=map, settings=settings)
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

    page.route("https://remote.org/data.json", handle)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#7/12.271/4.338")
    expect(page.locator(".umap-div-icon")).to_have_count(1)
    expect(page.get_by_role("tooltip", name="Point 1")).to_be_visible()
    page.get_by_role("button", name="Zoom out").click()

    # We are above fromZoom
    expect(page.locator(".umap-div-icon")).to_have_count(0)

    page.get_by_role("button", name="Zoom in").click()

    expect(page.locator(".umap-div-icon")).to_have_count(1)
    expect(page.get_by_role("tooltip", name="Point 2")).to_be_visible()
