import re

from playwright.sync_api import expect

from umap.models import Map

from ..base import DataLayerFactory, MapFactory

DATALAYER_UPDATE = re.compile(r".*/datalayer/update/.*")


def test_websocket_connection_can_sync_markers(
    context, live_server, websocket_server, tilelayer
):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()
    DataLayerFactory(map=map, data={})

    # Create two tabs
    peerA = context.new_page()
    peerA.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    peerB = context.new_page()
    peerB.goto(f"{live_server.url}{map.get_absolute_url()}?edit")

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

    # Add a second marker from peer B
    b_create_marker = peerB.get_by_title("Draw a marker")
    expect(b_create_marker).to_be_visible()
    b_create_marker.click()

    b_map_el = peerB.locator("#map")
    b_map_el.click(position={"x": 225, "y": 225})
    expect(a_marker_pane).to_have_count(2)
    expect(b_marker_pane).to_have_count(2)

    # FIXME: find a better locator for markers
    b_first_marker = peerB.locator("div:nth-child(4) > div:nth-child(2)").first
    a_first_marker = peerA.locator("div:nth-child(4) > div:nth-child(2)").first

    # Drag a marker on peer B and check that it moved on peer A
    a_first_marker.bounding_box() == b_first_marker.bounding_box()
    b_old_bbox = b_first_marker.bounding_box()
    b_first_marker.drag_to(b_map_el, target_position={"x": 250, "y": 250})

    assert b_old_bbox is not b_first_marker.bounding_box()
    a_first_marker.bounding_box() == b_first_marker.bounding_box()

    # Delete a marker from peer A and check it's been deleted on peer B
    a_first_marker.click(button="right")
    peerA.on("dialog", lambda dialog: dialog.accept())
    peerA.get_by_role("link", name="Delete this feature").click()
    expect(a_marker_pane).to_have_count(1)
    expect(b_marker_pane).to_have_count(1)


def test_websocket_connection_can_sync_polygons(
    context, live_server, websocket_server, tilelayer
):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()
    DataLayerFactory(map=map, data={})

    # Create two tabs
    peerA = context.new_page()
    peerA.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    peerB = context.new_page()
    peerB.goto(f"{live_server.url}{map.get_absolute_url()}?edit")

    b_map_el = peerB.locator("#map")

    # Click on the Draw a polygon button on a new map.
    create_line = peerA.locator(".leaflet-control-toolbar ").get_by_title(
        "Draw a polygon"
    )
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

    # It is created on peerA, but not yet synced
    expect(a_polygons).to_have_count(1)
    expect(b_polygons).to_have_count(0)

    # Escaping the edition syncs
    peerA.keyboard.press("Escape")
    expect(a_polygons).to_have_count(1)
    expect(b_polygons).to_have_count(1)

    # change the geometry by moving a point on peer B
    a_polygon = peerA.locator("path")
    b_polygon = peerB.locator("path")
    b_polygon_bbox_t1 = b_polygon.bounding_box()
    a_polygon_bbox_t1 = a_polygon.bounding_box()
    assert b_polygon_bbox_t1 == a_polygon_bbox_t1

    b_polygon.click()
    peerB.get_by_role("link", name="Toggle edit mode (⇧+Click)").click()

    edited_vertex = peerB.locator("div:nth-child(6)").first
    edited_vertex.drag_to(b_map_el, target_position={"x": 233, "y": 126})
    peerB.keyboard.press("Escape")

    b_polygon_bbox_t2 = b_polygon.bounding_box()
    a_polygon_bbox_t2 = a_polygon.bounding_box()

    assert b_polygon_bbox_t2 != b_polygon_bbox_t1
    assert b_polygon_bbox_t2 == a_polygon_bbox_t2

    # Move the polygon on peer B and check it moved also on peer A
    b_polygon.click()
    peerB.get_by_role("link", name="Toggle edit mode (⇧+Click)").click()

    b_polygon.drag_to(b_map_el, target_position={"x": 400, "y": 400})
    peerB.keyboard.press("Escape")
    b_polygon_bbox_t3 = b_polygon.bounding_box()
    a_polygon_bbox_t3 = a_polygon.bounding_box()

    assert b_polygon_bbox_t3 != b_polygon_bbox_t2
    assert b_polygon_bbox_t3 == a_polygon_bbox_t3

    # Delete a polygon from peer A and check it's been deleted on peer B
    a_polygon.click(button="right")
    peerA.on("dialog", lambda dialog: dialog.accept())
    peerA.get_by_role("link", name="Delete this feature").click()
    expect(a_polygons).to_have_count(0)
    expect(b_polygons).to_have_count(0)
