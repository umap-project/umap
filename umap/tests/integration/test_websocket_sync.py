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

    # Click on the Draw a marker button on a new map.
    a_create_marker = peerA.get_by_title("Draw a marker")
    expect(a_create_marker).to_be_visible()
    a_create_marker.click()

    # Click on the map, it will place a marker at the given position.
    a_map_el = peerA.locator("#map")
    a_map_el.click(position={"x": 220, "y": 220})
    expect(a_marker_pane).to_have_count(1)
    expect(b_marker_pane).to_have_count(1)
