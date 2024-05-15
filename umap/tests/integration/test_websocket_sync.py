import re

from playwright.sync_api import expect

from umap.models import Map

from ..base import DataLayerFactory, MapFactory

DATALAYER_UPDATE = re.compile(r".*/datalayer/update/.*")


def test_websocket_connection_can_sync_markers(
    context, live_server, websocket_server, tilelayer
):
    # Create a new map
    map = MapFactory(name="sync", edit_status=Map.ANONYMOUS)
    map.settings["properties"]["syncEnabled"] = True
    map.save()
    DataLayerFactory(map=map, data={})

    # Now navigate to this map from two tabs
    peerA = context.new_page()
    peerA.goto(f"{live_server.url}{map.get_absolute_url()}?edit")

    # Now navigate to this map from another tab
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

    b_first_marker = peerB.locator("div:nth-child(4) > div:nth-child(2)").first
    a_first_marker = peerA.locator("div:nth-child(4) > div:nth-child(2)").first

    # Drag a marker on peer B and check that it moved on peer A
    a_first_marker.bounding_box() == b_first_marker.bounding_box()
    b_old_bbox = b_first_marker.bounding_box()
    b_first_marker.drag_to(b_map_el, target_position={"x": 250, "y": 250})

    assert b_old_bbox is not b_first_marker.bounding_box()
    a_first_marker.bounding_box() == b_first_marker.bounding_box()

    a_first_marker.click(button="right")
    peerA.on("dialog", lambda dialog: dialog.accept())
    peerA.get_by_role("link", name="Delete this feature").click()
    expect(a_marker_pane).to_have_count(1)
    expect(b_marker_pane).to_have_count(1)
