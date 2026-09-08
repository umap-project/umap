import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


DATALAYER_DATA = {
    "type": "FeatureCollection",
    "properties": {
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


def test_can_drag_single_marker_in_cluster_layer(
    live_server, page, tilelayer, openmap, assert_screenshot
):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)

    # Center the map on the marker, so we can drag it
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#7/46.1/3.34")

    expect(page.locator(".edit-undo")).to_be_disabled()

    # Drag marker
    assert_screenshot(page, "before_drag", ui=False)
    box = page.locator("#map").bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(cx, cy)
    page.mouse.down()
    page.mouse.move(cx - 60, cy - 60, steps=10)
    page.mouse.up()
    assert_screenshot(page, "after_drag", ui=False)

    expect(page.locator(".edit-undo")).to_be_enabled()


def test_can_drag_marker_in_cluster(
    live_server, page, tilelayer, openmap, assert_screenshot
):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    # Put the cluster at the map center, to make easier to click on it.
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#7/46.92/3.34")

    expect(page.locator(".edit-undo")).to_be_disabled()
    assert_screenshot(page, "before", ui=False)
    page.locator("#map").click()
    assert_screenshot(page, "spiderified", ui=False)
    # Spiderfying spreads the first member at the maximum radius, due east of the
    # cluster it came from — so 150px to the right of the map center.
    cx, cy = 790, 360
    page.mouse.move(cx, cy)
    page.mouse.down()
    page.mouse.move(cx - 60, cy - 60, steps=10)
    page.mouse.up()
    assert_screenshot(page, "after", ui=False)
    expect(page.locator(".edit-undo")).to_be_enabled()


def test_cannot_drag_cluster(live_server, page, tilelayer, openmap, wait_for_edit_mode):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    # Put the cluster at the map center, to make easier to click on it.
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#7/46.92/3.34")

    expect(page.locator(".edit-undo")).to_be_disabled()
    wait_for_edit_mode(page)

    box = page.locator("#map").bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    before = page.url
    page.mouse.move(cx, cy)
    page.mouse.down()
    page.mouse.move(cx - 60, cy - 60, steps=10)
    page.mouse.up()

    # A cluster stands for several features, and has no geometry of its own to drag.
    expect(page.locator(".edit-undo")).to_be_disabled()
    # Nothing took the drag, so it reached the map, which panned: had the cluster
    # been draggable the view would have stayed put, and this test proved nothing.
    expect(page).not_to_have_url(before)


def test_can_change_datalayer_of_marker_in_cluster(
    live_server, page, datalayer, openmap, tilelayer, assert_screenshot
):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    datalayer.settings["iconClass"] = "Ball"
    datalayer.save()
    page.goto(
        f"{live_server.url}{openmap.get_absolute_url()}"
        "?edit&onLoadPanel=databrowser#7/46.920/3.340"
    )

    target = page.locator(f'.umap-browser details[data-id="{datalayer.pk}"]')
    expect(target).not_to_contain_text("again one another point")
    assert_screenshot(page, "before_change", ui=False)

    # The marker get highlighted when OL adds it to the selection, which only happen
    # after 250ms, delay of OL before firing a singleclick event. So wait for that
    # before doing the screenshot, so it's stable.
    page.evaluate(
        "() => { window.singleclick = new Promise((done) => "
        "U.MAP.mapProxy.map.once('singleclick', done)) }"
    )
    # Shift-click opens the edit form of the lone marker, south of the cluster.
    page.locator("#map").click(position={"x": 640, "y": 468}, modifiers=["Shift"])
    page.evaluate("() => window.singleclick")
    page.get_by_role("combobox").select_option(str(datalayer.pk))

    expect(target).to_contain_text("again one another point")
    # Its new layer draws Ball icons.
    assert_screenshot(page, "after_change", ui=False)


def test_can_combine_cluster_with_remote_data_and_fromZoom(
    page, live_server, tilelayer, map, assert_screenshot
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
    # This data contains two datasets, which whould be read one at load and
    # the other when zoom-in again, as the data is remote data and with the
    # dynamic option (so each map move == one call to the remote resource).
    # Given there is also the fromZoom option set on the datalayer, the
    # zoom out should not call the remote data.
    data = [
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"name": "Call 3"},
                    "geometry": {
                        "type": "Point",
                        "coordinates": [4.3375, 12.2607],
                    },
                },
                {
                    "type": "Feature",
                    "properties": {"name": "Call 3 bis"},
                    "geometry": {
                        "type": "Point",
                        "coordinates": [4.3375, 12.2707],
                    },
                },
            ],
        },
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"name": "Call 2"},
                    "geometry": {
                        "type": "Point",
                        "coordinates": [4.3375, 12.2607],
                    },
                },
                {
                    "type": "Feature",
                    "properties": {"name": "Call 2 bis"},
                    "geometry": {
                        "type": "Point",
                        "coordinates": [4.3375, 12.2707],
                    },
                },
            ],
        },
        {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {"name": "Call 1"},
                    "geometry": {
                        "type": "Point",
                        "coordinates": [4.3375, 12.2607],
                    },
                },
                {
                    "type": "Feature",
                    "properties": {"name": "Call 1 bis"},
                    "geometry": {
                        "type": "Point",
                        "coordinates": [4.3375, 12.2707],
                    },
                },
            ],
        },
    ]

    requests = 0

    def handle(route):
        nonlocal requests
        requests += 1
        route.fulfill(json=data.pop())

    page.route("https://remote.org/data.json", handle)
    page.goto(
        f"{live_server.url}{map.get_absolute_url()}"
        "?onLoadPanel=databrowser#7/12.271/4.338"
    )
    # The browser reads the model, so it cannot tell a hidden layer from a drawn
    # one: what is on the map is checked by the screenshots.
    expect(page.locator(".umap-browser .feature.marker")).to_have_count(2)
    # Close enough to each other to be drawn as a single cluster.
    assert_screenshot(page, "clustered", ui=False)
    assert requests == 1

    page.get_by_role("button", name="Zoom out").click()
    # We are above fromZoom, so no call of the remote resource
    assert_screenshot(page, "hidden", ui=False)
    assert requests == 1

    page.get_by_role("button", name="Zoom in").click()
    assert_screenshot(page, "clustered", ui=False)
    assert requests == 2

    # Clicking the cluster fits it, which moves the map, hence one more call.
    page.locator("#map").click(position={"x": 640, "y": 360})
    # Once apart, each marker carries its own label.
    assert_screenshot(page, "split", ui=False)
    assert requests == 3
