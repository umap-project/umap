import re

import pytest
from playwright.sync_api import expect

from umap.models import Map

from ..base import DataLayerFactory, MapFactory

DATALAYER_UPDATE = re.compile(r".*/datalayer/update/.*")


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_markers(
    new_page, live_server, websocket_server, tilelayer
):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()
    DataLayerFactory(map=map, data={})

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    peerB = new_page("Page B")
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
    peerA.locator("body").type("Synced name")
    peerA.locator("body").press("Escape")

    peerB.locator(".leaflet-marker-icon").first.click()
    peerB.get_by_role("link", name="Toggle edit mode (⇧+Click)").click()
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
    peerA.locator("dialog").get_by_role("button", name="OK").click()
    expect(a_marker_pane).to_have_count(1)
    expect(b_marker_pane).to_have_count(1)


@pytest.mark.xdist_group(name="websockets")
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
    peerA.get_by_role("button", name="Delete this feature").click()
    peerA.locator("dialog").get_by_role("button", name="OK").click()
    expect(a_polygons).to_have_count(0)
    expect(b_polygons).to_have_count(0)


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_map_properties(
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

    # Name change is synced
    peerA.get_by_role("link", name="Edit map name and caption").click()
    peerA.locator('input[name="name"]').click()
    peerA.locator('input[name="name"]').fill("it syncs!")

    expect(peerB.locator(".map-name").last).to_have_text("it syncs!")

    # Zoom control is synced
    peerB.get_by_role("link", name="Map advanced properties").click()
    peerB.locator("summary").filter(has_text="User interface options").click()
    peerB.locator("div").filter(
        has_text=re.compile(r"^Display the zoom control")
    ).locator("label").nth(2).click()

    expect(peerA.locator(".leaflet-control-zoom")).to_be_hidden()


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_datalayer_properties(
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

    # Layer addition, name and type are synced
    peerA.get_by_role("link", name="Manage layers").click()
    peerA.get_by_role("button", name="Add a layer").click()
    peerA.locator('input[name="name"]').click()
    peerA.locator('input[name="name"]').fill("synced layer!")
    peerA.get_by_role("combobox").select_option("Choropleth")
    peerA.locator("body").press("Escape")

    peerB.get_by_role("link", name="Manage layers").click()
    peerB.get_by_role("button", name="Edit").first.click()
    expect(peerB.locator('input[name="name"]')).to_have_value("synced layer!")
    expect(peerB.get_by_role("combobox")).to_have_value("Choropleth")


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_cloned_polygons(
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
    b_polygon.click(button="right")
    peerB.get_by_role("button", name="Clone this feature").click()

    expect(peerB.locator("path")).to_have_count(2)

    peerB.locator("path").nth(1).drag_to(b_map_el, target_position={"x": 400, "y": 400})
    peerB.locator("path").nth(1).click()
    peerB.locator("summary").filter(has_text="Shape properties").click()
    peerB.locator(".header > a:nth-child(2)").first.click()
    peerB.get_by_title("Orchid", exact=True).first.click()
    peerB.locator("#map").press("Escape")
    peerB.get_by_role("button", name="Save").click()

    expect(peerB.locator("path")).to_have_count(2)


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_late_joining_peer(
    new_page, live_server, websocket_server, tilelayer
):
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()
    DataLayerFactory(map=map, data={})

    # Create first peer (A) and have it join immediately
    peerA = new_page("Page A")
    peerA.goto(f"{live_server.url}{map.get_absolute_url()}?edit")

    # Add a marker from peer A
    a_create_marker = peerA.get_by_title("Draw a marker")
    expect(a_create_marker).to_be_visible()
    a_create_marker.click()

    a_map_el = peerA.locator("#map")
    a_map_el.click(position={"x": 220, "y": 220})
    peerA.locator("body").type("First marker")
    peerA.locator("body").press("Escape")

    # Add a polygon from peer A
    create_polygon = peerA.locator(".leaflet-control-toolbar ").get_by_title(
        "Draw a polygon"
    )
    create_polygon.click()

    a_map_el.click(position={"x": 200, "y": 200})
    a_map_el.click(position={"x": 100, "y": 200})
    a_map_el.click(position={"x": 100, "y": 100})
    a_map_el.click(position={"x": 200, "y": 100})
    a_map_el.click(position={"x": 200, "y": 100})
    peerA.keyboard.press("Escape")

    # Now create peer B and have it join
    peerB = new_page("Page B")
    peerB.goto(f"{live_server.url}{map.get_absolute_url()}?edit")

    # Check if peer B has received all the updates
    b_marker_pane = peerB.locator(".leaflet-marker-pane > div")
    b_polygons = peerB.locator(".leaflet-overlay-pane path[fill='DarkBlue']")

    expect(b_marker_pane).to_have_count(1)
    expect(b_polygons).to_have_count(1)

    # Verify marker properties
    peerB.locator(".leaflet-marker-icon").first.click()
    peerB.get_by_role("link", name="Toggle edit mode (⇧+Click)").click()
    expect(peerB.locator('input[name="name"]')).to_have_value("First marker")

    # Verify polygon exists (we've already checked the count)
    b_polygon = peerB.locator("path")
    expect(b_polygon).to_be_visible()

    # Optional: Verify polygon properties if you have any specific ones set

    # Clean up: close edit mode
    peerB.locator("body").press("Escape")
