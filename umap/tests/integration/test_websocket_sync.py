import re

import pytest
import redis
from django.conf import settings
from playwright.sync_api import expect

from umap.models import DataLayer, Map

from ..base import DataLayerFactory, MapFactory

DATALAYER_UPDATE = re.compile(r".*/datalayer/update/.*")

pytestmark = pytest.mark.django_db


def setup_function():
    # Sync client to prevent headache with pytest / pytest-asyncio and async
    client = redis.from_url(settings.REDIS_URL)
    # Make sure there are no dead peers in the Redis hash, otherwise asking for
    # operations from another peer may never be answered
    # FIXME this should not happen in an ideal world
    assert client.connection_pool.connection_kwargs["db"] == 15
    client.flushdb()


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_markers(new_page, asgi_live_server, tilelayer):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()
    DataLayerFactory(map=map, data={})

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")
    peerB = new_page("Page B")
    peerB.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")

    a_marker_pane = peerA.locator(".leaflet-marker-pane > div")
    b_marker_pane = peerB.locator(".leaflet-marker-pane > div")
    expect(a_marker_pane).to_have_count(0)
    expect(b_marker_pane).to_have_count(0)

    # Add a marker from peer A
    a_create_marker = peerA.get_by_title("Draw a marker")
    expect(a_create_marker).to_be_visible()
    a_create_marker.click()

    a_map_el = peerA.locator("#map")
    a_map_el.click(position={"x": 220, "y": 220})
    expect(a_marker_pane).to_have_count(1)
    expect(b_marker_pane).to_have_count(1)
    # Peer B should not be in state dirty
    expect(peerB.get_by_role("button", name="View")).to_be_visible()
    expect(peerB.get_by_role("button", name="Cancel edits")).to_be_hidden()
    peerA.locator("body").type("Synced name")
    peerA.locator("body").press("Escape")
    peerA.wait_for_timeout(300)

    peerB.locator(".leaflet-marker-icon").first.click(button="right")
    peerB.get_by_role("button", name="Toggle edit mode (⇧+Click)").click()
    expect(peerB.locator('input[name="name"]')).to_have_value("Synced name")

    a_first_marker = peerA.locator("div:nth-child(4) > div:nth-child(2)").first
    b_first_marker = peerB.locator("div:nth-child(4) > div:nth-child(2)").first

    # Add a second marker from peer B
    b_create_marker = peerB.get_by_title("Draw a marker")
    expect(b_create_marker).to_be_visible()
    b_create_marker.click()

    b_map_el = peerB.locator("#map")
    b_map_el.click(position={"x": 225, "y": 225})
    expect(a_marker_pane).to_have_count(2)
    expect(b_marker_pane).to_have_count(2)

    # Drag a marker on peer B and check that it moved on peer A
    assert a_first_marker.bounding_box() == b_first_marker.bounding_box()
    b_old_bbox = b_first_marker.bounding_box()
    b_first_marker.drag_to(b_map_el, target_position={"x": 250, "y": 250})

    assert b_old_bbox is not b_first_marker.bounding_box()
    assert a_first_marker.bounding_box() == b_first_marker.bounding_box()

    # Delete a marker from peer A and check it's been deleted on peer B
    a_first_marker.click(button="right")
    peerA.get_by_role("button", name="Delete this feature").click()
    expect(a_marker_pane).to_have_count(1)
    expect(b_marker_pane).to_have_count(1)


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_polygons(context, asgi_live_server, tilelayer):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()
    DataLayerFactory(map=map, data={})

    # Create two tabs
    peerA = context.new_page()
    peerA.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")
    peerB = context.new_page()
    peerB.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")

    b_map_el = peerB.locator("#map")

    # Click on the Draw a polygon button on a new map.
    create_line = peerA.locator(".umap-edit-bar ").get_by_title("Draw a polygon")
    create_line.click()

    a_polygons = peerA.locator(".leaflet-overlay-pane path[fill='DarkBlue']")
    b_polygons = peerB.locator(".leaflet-overlay-pane path[fill='DarkBlue']")
    expect(a_polygons).to_have_count(0)
    expect(b_polygons).to_have_count(0)

    # Click on the map, it will create a polygon.
    map = peerA.locator("#map")
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 100})

    # It is created on peerA, and should be on peerB
    expect(a_polygons).to_have_count(1)
    expect(b_polygons).to_have_count(1)

    # Escaping the edition should not duplicate
    peerA.keyboard.press("Escape")
    expect(a_polygons).to_have_count(1)
    expect(b_polygons).to_have_count(1)

    # change the geometry by moving a point on peer B
    a_polygon = peerA.locator("path")
    b_polygon = peerB.locator("path")
    b_polygon_bbox_t1 = b_polygon.bounding_box()
    a_polygon_bbox_t1 = a_polygon.bounding_box()
    assert b_polygon_bbox_t1 == a_polygon_bbox_t1

    b_polygon.click(button="right")
    peerB.get_by_role("button", name="Toggle edit mode (⇧+Click)").click()

    edited_vertex = peerB.locator("div:nth-child(6)").first
    edited_vertex.drag_to(b_map_el, target_position={"x": 233, "y": 126})
    peerB.keyboard.press("Escape")

    b_polygon_bbox_t2 = b_polygon.bounding_box()
    a_polygon_bbox_t2 = a_polygon.bounding_box()

    assert b_polygon_bbox_t2 != b_polygon_bbox_t1
    assert b_polygon_bbox_t2 == a_polygon_bbox_t2

    # Move the polygon on peer B and check it moved also on peer A
    b_polygon.click(button="right")
    peerB.get_by_role("button", name="Toggle edit mode (⇧+Click)").click()

    b_polygon.drag_to(b_map_el, target_position={"x": 400, "y": 400})
    peerB.keyboard.press("Escape")
    b_polygon_bbox_t3 = b_polygon.bounding_box()
    a_polygon_bbox_t3 = a_polygon.bounding_box()

    assert b_polygon_bbox_t3 != b_polygon_bbox_t2
    assert b_polygon_bbox_t3 == a_polygon_bbox_t3

    # Delete a polygon from peer A and check it's been deleted on peer B
    a_polygon.click(button="right")
    peerA.get_by_role("button", name="Delete this feature").click()
    expect(a_polygons).to_have_count(0)
    expect(b_polygons).to_have_count(0)


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_map_properties(
    new_page, asgi_live_server, tilelayer
):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()
    DataLayerFactory(map=map, data={})

    # Create two tabs
    peerA = new_page()
    peerA.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")
    peerB = new_page()
    peerB.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")

    # Name change is synced
    peerA.get_by_role("button", name="Edit map name and caption").click()
    peerA.locator('input[name="name"]').click()
    peerA.locator('input[name="name"]').fill("it syncs!")

    expect(peerB.locator(".map-name").last).to_have_text("it syncs!")

    # Zoom control is synced
    peerB.get_by_role("button", name="Map advanced properties").click()
    peerB.locator("summary").filter(has_text="User interface options").click()
    switch = peerB.locator("div.formbox").filter(
        has_text=re.compile("Display the zoom control")
    )
    expect(switch).to_be_visible()
    switch.get_by_text("Never").click()

    expect(peerA.locator(".leaflet-control-zoom")).to_be_hidden()


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_datalayer_properties(
    new_page, asgi_live_server, tilelayer
):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()
    DataLayerFactory(map=map, data={})

    # Create two tabs
    peerA = new_page()
    peerA.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")
    peerB = new_page()
    peerB.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")

    # Layer addition, name and type are synced
    peerA.get_by_role("button", name="Manage layers").click()
    peerA.get_by_role("button", name="Add a layer").click()
    peerA.locator('input[name="name"]').click()
    peerA.locator('input[name="name"]').fill("synced layer!")
    peerA.get_by_role("combobox").select_option("Choropleth")
    peerA.locator("body").press("Escape")

    peerB.get_by_role("button", name="Manage layers").click()
    peerB.locator(".panel.right").get_by_role("button", name="Edit").first.click()
    expect(peerB.locator('input[name="name"]')).to_have_value("synced layer!")
    expect(peerB.get_by_role("combobox")).to_have_value("Choropleth")


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_cloned_polygons(
    context, asgi_live_server, tilelayer
):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()
    DataLayerFactory(map=map, data={})

    # Create two tabs
    peerA = context.new_page()
    peerA.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")
    peerB = context.new_page()
    peerB.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")

    b_map_el = peerB.locator("#map")

    # Click on the Draw a polygon button on a new map.
    create_line = peerA.locator(".umap-edit-bar ").get_by_title("Draw a polygon")
    create_line.click()

    a_polygons = peerA.locator(".leaflet-overlay-pane path[fill='DarkBlue']")
    b_polygons = peerB.locator(".leaflet-overlay-pane path[fill='DarkBlue']")
    expect(a_polygons).to_have_count(0)
    expect(b_polygons).to_have_count(0)

    # Click on the map, it will create a polygon.
    map = peerA.locator("#map")
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 200, "y": 100})

    # Escaping the edition syncs
    peerA.keyboard.press("Escape")
    expect(a_polygons).to_have_count(1)
    expect(b_polygons).to_have_count(1)

    # Save from peer A
    peerA.get_by_role("button", name="Save").click()

    b_polygon = peerB.locator("path")

    # Clone on peer B and save
    b_polygon.click(button="right", delay=200)
    peerB.get_by_role("button", name="Clone this feature").click()

    expect(peerB.locator("path")).to_have_count(2)

    peerB.locator("path").nth(1).drag_to(b_map_el, target_position={"x": 400, "y": 400})
    peerB.locator("path").nth(1).click()
    peerB.locator("summary").filter(has_text="Shape properties").click()
    peerB.locator(".umap-field-color button.define").first.click()
    peerB.get_by_title("Orchid", exact=True).first.click()
    peerB.locator("#map").press("Escape")
    peerB.get_by_role("button", name="Save").click()

    expect(peerB.locator("path")).to_have_count(2)


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_late_joining_peer(
    new_page, asgi_live_server, tilelayer
):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()
    DataLayerFactory(map=map, data={})

    # Create first peer (A) and have it join immediately
    peerA = new_page("Page A")
    peerA.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")

    # Add a marker from peer A
    a_create_marker = peerA.get_by_title("Draw a marker")
    expect(a_create_marker).to_be_visible()
    a_create_marker.click()

    a_map_el = peerA.locator("#map")
    a_map_el.click(position={"x": 220, "y": 220})
    peerA.locator("body").type("First marker")
    peerA.locator("body").press("Escape")
    peerA.wait_for_timeout(300)

    # Add a polygon from peer A
    create_polygon = peerA.locator(".umap-edit-bar ").get_by_title("Draw a polygon")
    create_polygon.click()

    a_map_el.click(position={"x": 200, "y": 200})
    a_map_el.click(position={"x": 100, "y": 200})
    a_map_el.click(position={"x": 100, "y": 100})
    a_map_el.click(position={"x": 200, "y": 100})
    a_map_el.click(position={"x": 200, "y": 100})
    peerA.keyboard.press("Escape")

    # Now create peer B and have it join
    peerB = new_page("Page B")
    peerB.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")

    # Check if peer B has received all the updates
    b_marker_pane = peerB.locator(".leaflet-marker-pane > div")
    b_polygons = peerB.locator(".leaflet-overlay-pane path[fill='DarkBlue']")

    expect(b_marker_pane).to_have_count(1)
    expect(b_polygons).to_have_count(1)

    # Verify marker properties
    peerB.locator(".leaflet-marker-icon").first.click(button="right")
    peerB.get_by_role("button", name="Toggle edit mode (⇧+Click)").click()
    expect(peerB.locator('input[name="name"]')).to_have_value("First marker")

    # Verify polygon exists (we've already checked the count)
    b_polygon = peerB.locator("path")
    expect(b_polygon).to_be_visible()

    # Optional: Verify polygon properties if you have any specific ones set

    # Clean up: close edit mode
    peerB.locator("body").press("Escape")


@pytest.mark.xdist_group(name="websockets")
def test_should_sync_datalayers(new_page, asgi_live_server, tilelayer):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()

    assert not DataLayer.objects.count()

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")
    peerB = new_page("Page B")
    peerB.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")

    # Create a new layer from peerA
    peerA.get_by_role("button", name="Manage layers").click()
    peerA.get_by_role("button", name="Add a layer").click()

    # Check layer has been sync to peerB
    peerB.get_by_role("button", name="Open browser").click()
    expect(peerB.get_by_text("Layer 1")).to_be_visible()

    # Draw a marker in layer 1 from peerA
    peerA.get_by_role("button", name="Draw a marker (Ctrl+M)").click()
    peerA.locator("#map").click()

    # Check marker is visible from peerB
    expect(peerB.locator(".leaflet-marker-icon")).to_be_visible()

    # Save layer to the server
    with peerA.expect_response(re.compile(".*/datalayer/create/.*")):
        peerA.get_by_role("button", name="Save").click()

    assert DataLayer.objects.count() == 1

    # Create another layer from peerA and draw a marker on it (without saving to server)
    peerA.get_by_role("button", name="Manage layers").click()
    peerA.get_by_role("button", name="Add a layer").click()
    peerA.get_by_role("button", name="Draw a marker (Ctrl+M)").click()
    peerA.locator("#map").click()

    # Make sure this new marker is in Layer 2 for peerB
    # Show features for this layer in the brower.
    peerB.locator("summary").filter(has_text="Layer 2").click()
    expect(peerB.locator("li").filter(has_text="Layer 2")).to_be_visible()
    peerB.locator(".panel.left").get_by_role("button", name="Show/hide layer").nth(
        1
    ).click()
    expect(peerB.locator(".leaflet-marker-icon")).to_be_visible()

    # Now draw a marker from peerB
    peerB.get_by_role("button", name="Draw a marker (Ctrl+M)").click()
    peerB.locator("#map").click()
    peerB.locator('input[name="name"]').fill("marker from peerB")

    # Save from peer B
    with peerB.expect_response(re.compile(".*/datalayer/create/.*")):
        peerB.get_by_role("button", name="Save").click()

    assert DataLayer.objects.count() == 2

    # Check this new marker is visible from peerA
    peerA.get_by_role("button", name="Open browser").click()
    peerA.locator(".panel.left").get_by_role("button", name="Show/hide layer").nth(
        1
    ).click()

    # Peer A should not be in dirty state
    expect(peerA.locator("body")).not_to_have_class(re.compile(".*umap-is-dirty.*"))

    # Peer A should only have two markers
    expect(peerA.locator(".leaflet-marker-icon")).to_have_count(2)

    assert DataLayer.objects.count() == 2


@pytest.mark.xdist_group(name="websockets")
def test_should_sync_datalayers_delete(new_page, asgi_live_server, tilelayer):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()
    data1 = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "Point 1",
                },
                "geometry": {"type": "Point", "coordinates": [0.065918, 48.385442]},
            },
        ],
        "_umap_options": {
            "name": "datalayer 1",
        },
    }
    data2 = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "Point 2",
                },
                "geometry": {"type": "Point", "coordinates": [3.55957, 49.767074]},
            },
        ],
        "_umap_options": {
            "name": "datalayer 2",
        },
    }
    DataLayerFactory(map=map, data=data1)
    DataLayerFactory(map=map, data=data2)

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")
    peerB = new_page("Page B")
    peerB.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")

    peerA.get_by_role("button", name="Open browser").click()
    expect(peerA.locator(".panel").get_by_text("datalayer 1")).to_be_visible()
    expect(peerA.locator(".panel").get_by_text("datalayer 2")).to_be_visible()
    peerB.get_by_role("button", name="Open browser").click()
    expect(peerB.locator(".panel").get_by_text("datalayer 1")).to_be_visible()
    expect(peerB.locator(".panel").get_by_text("datalayer 2")).to_be_visible()

    # Delete "datalayer 2" in peerA
    peerA.locator(".datalayer").get_by_role("button", name="Delete layer").first.click()
    expect(peerA.locator(".panel").get_by_text("datalayer 2")).to_be_hidden()
    expect(peerB.locator(".panel").get_by_text("datalayer 2")).to_be_hidden()

    # Save delete to the server
    with peerA.expect_response(re.compile(".*/datalayer/delete/.*")):
        peerA.get_by_role("button", name="Save").click()
    expect(peerA.locator(".panel").get_by_text("datalayer 2")).to_be_hidden()
    expect(peerB.locator(".panel").get_by_text("datalayer 2")).to_be_hidden()


@pytest.mark.xdist_group(name="websockets")
def test_create_and_sync_map(new_page, asgi_live_server, tilelayer, login, user):
    # Create a syncable map with peerA
    peerA = login(user, prefix="Page A")
    peerA.goto(f"{asgi_live_server.url}/en/map/new/")
    peerA.get_by_role("button", name="Map advanced properties").click()
    expect(peerA.get_by_text("Real-time collaboration", exact=True)).to_be_hidden()
    with peerA.expect_response(re.compile("./map/create/.*")):
        peerA.get_by_role("button", name="Save Draft").click()
    peerA.get_by_role("button", name="Map advanced properties").click()
    expect(peerA.get_by_text("Real-time collaboration", exact=True)).to_be_visible()
    peerA.get_by_text("Real-time collaboration", exact=True).click()
    peerA.get_by_text("Enable real-time").click()
    peerA.get_by_role("button", name="Update permissions and editors").click()
    peerA.locator('select[name="share_status"]').select_option(str(Map.PUBLIC))
    with peerA.expect_response(re.compile("./update/settings/.*")):
        peerA.get_by_role("button", name="Save").click()
    expect(peerA.get_by_role("button", name="Cancel edits")).to_be_hidden()
    # Quit edit mode
    peerA.get_by_role("button", name="View").click()

    # Open map and go to edit mode with peer B
    peerB = new_page("Page B")
    peerB.goto(peerA.url)
    peerB.get_by_role("button", name="Edit").click()

    # Create a marker from peerA
    markersA = peerA.locator(".leaflet-marker-pane > div")
    markersB = peerB.locator(".leaflet-marker-pane > div")
    expect(markersA).to_have_count(0)
    expect(markersB).to_have_count(0)

    # Add a marker from peer A
    peerA.get_by_role("button", name="Edit").click()
    peerA.get_by_title("Draw a marker").click()
    peerA.locator("#map").click(position={"x": 220, "y": 220})
    expect(markersA).to_have_count(1)
    expect(markersB).to_have_count(1)

    # Make sure only one layer has been created on peer B
    peerB.get_by_role("button", name="Open browser").click()
    expect(peerB.locator("summary").get_by_text("Layer 1")).to_be_visible()
    peerB.get_by_role("button", name="Close").click()

    # Save and quit edit mode again
    with peerA.expect_response(re.compile("./datalayer/create/.*")):
        peerA.get_by_role("button", name="Save").click()
    peerA.get_by_role("button", name="View").click()
    expect(markersA).to_have_count(1)
    expect(markersB).to_have_count(1)
    peerA.wait_for_timeout(500)
    expect(markersA).to_have_count(1)
    expect(markersB).to_have_count(1)

    # Peer B should not be in state dirty
    expect(peerB.get_by_role("button", name="View")).to_be_visible()
    expect(peerB.get_by_role("button", name="Cancel edits")).to_be_hidden()

    # Add a marker from peer B
    peerB.get_by_title("Draw a marker").click()
    peerB.locator("#map").click(position={"x": 200, "y": 200})
    expect(markersB).to_have_count(2)
    expect(markersA).to_have_count(1)
    with peerB.expect_response(re.compile("./datalayer/update/.*")):
        peerB.get_by_role("button", name="Save").click()
    expect(markersB).to_have_count(2)
    expect(markersA).to_have_count(1)
    peerA.get_by_role("button", name="Edit").click()
    expect(markersA).to_have_count(2)
    expect(markersB).to_have_count(2)


@pytest.mark.xdist_group(name="websockets")
def test_saved_datalayer_are_not_duplicated(new_page, asgi_live_server, tilelayer):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()

    # Create one tab
    peerA = new_page("Page A")
    peerA.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")
    # Create a new datalayer
    peerA.get_by_title("Manage layers").click()
    peerA.get_by_title("Add a layer").click()
    peerA.locator("#map").click(position={"x": 220, "y": 220})
    # Save layer to the server, so now the datalayer exist on the server AND
    # is still in the live operations of peer A
    with peerA.expect_response(re.compile(".*/datalayer/create/.*")):
        peerA.get_by_role("button", name="Save").click()

    # Now load the map from another tab
    peerB = new_page("Page B")
    peerB.goto(peerA.url)
    peerB.get_by_role("button", name="Open browser").click()
    expect(peerB.get_by_text("Layer 1")).to_be_visible()
    peerB.get_by_role("button", name="Edit").click()
    peerA.wait_for_timeout(300)  # Let the synchro roll on.
    expect(peerB.get_by_text("Layer 1")).to_be_visible()


@pytest.mark.xdist_group(name="websockets")
def test_should_sync_saved_status(new_page, asgi_live_server, tilelayer):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")
    peerB = new_page("Page B")
    peerB.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")

    # Create a new marker from peerA
    peerA.get_by_title("Draw a marker").click()
    peerA.locator("#map").click(position={"x": 220, "y": 220})

    # Peer A should be in dirty state
    expect(peerA.locator("body")).to_have_class(re.compile(".*umap-is-dirty.*"))

    # Peer B should not be in dirty state
    expect(peerB.locator("body")).not_to_have_class(re.compile(".*umap-is-dirty.*"))

    # Create a new marker from peerB
    peerB.get_by_title("Draw a marker").click()
    peerB.locator("#map").click(position={"x": 200, "y": 250})

    # Peer B should be in dirty state
    expect(peerB.locator("body")).to_have_class(re.compile(".*umap-is-dirty.*"))

    # Peer A should still be in dirty state
    expect(peerA.locator("body")).to_have_class(re.compile(".*umap-is-dirty.*"))

    # Save layer to the server from peerA
    with peerA.expect_response(re.compile(".*/datalayer/create/.*")):
        peerA.get_by_role("button", name="Save").click()

    # Peer B should not be in dirty state
    expect(peerB.locator("body")).not_to_have_class(re.compile(".*umap-is-dirty.*"))

    # Peer A should not be in dirty state
    expect(peerA.locator("body")).not_to_have_class(re.compile(".*umap-is-dirty.*"))


@pytest.mark.xdist_group(name="websockets")
def test_should_sync_line_on_escape(new_page, asgi_live_server, tilelayer):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")
    peerB = new_page("Page B")
    peerB.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")

    # Create a new marker from peerA
    peerA.get_by_title("Draw a polyline").click()
    peerA.locator("#map").click(position={"x": 220, "y": 220})
    peerA.locator("#map").click(position={"x": 200, "y": 200})
    peerA.locator("body").press("Escape")

    expect(peerA.locator("path")).to_have_count(1)
    expect(peerB.locator("path")).to_have_count(1)


@pytest.mark.xdist_group(name="websockets")
def test_should_sync_datalayer_clear(
    new_page, asgi_live_server, tilelayer, map, datalayer
):
    map.settings["properties"]["syncEnabled"] = True
    map.edit_status = Map.ANONYMOUS
    map.save()

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")
    peerB = new_page("Page B")
    peerB.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")
    expect(peerA.locator(".leaflet-marker-icon")).to_have_count(1)
    expect(peerB.locator(".leaflet-marker-icon")).to_have_count(1)

    # Clear layer in peer A
    peerA.get_by_role("button", name="Manage layers").click()
    peerA.get_by_role("button", name="Edit", exact=True).click()
    peerA.locator("summary").filter(has_text="Advanced actions").click()
    peerA.get_by_role("button", name="Empty").click()
    expect(peerA.locator(".leaflet-marker-icon")).to_have_count(0)
    expect(peerB.locator(".leaflet-marker-icon")).to_have_count(0)

    # Undo in peer A
    peerA.locator(".edit-undo").click()
    expect(peerA.locator(".leaflet-marker-icon")).to_have_count(1)
    expect(peerB.locator(".leaflet-marker-icon")).to_have_count(1)


@pytest.mark.xdist_group(name="websockets")
def test_should_save_remote_dirty_datalayers(new_page, asgi_live_server, tilelayer):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()

    assert not DataLayer.objects.count()

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")
    peerB = new_page("Page B")
    peerB.goto(f"{asgi_live_server.url}{map.get_absolute_url()}?edit")

    # Create a new layer from peerA
    peerA.get_by_role("button", name="Manage layers").click()
    peerA.get_by_role("button", name="Add a layer").click()

    # Create a new layer from peerB
    peerB.get_by_role("button", name="Manage layers").click()
    peerB.get_by_role("button", name="Add a layer").click()

    # Save from peerA to the server
    counter = 0

    def on_response(response):
        nonlocal counter
        if "/datalayer/create/" in response.url:
            counter += 1
        # Wait for the two datalayer saves
        if counter == 2:
            return True
        return False

    with peerA.expect_response(on_response):
        peerA.get_by_role("button", name="Save").click()

    assert DataLayer.objects.count() == 2
