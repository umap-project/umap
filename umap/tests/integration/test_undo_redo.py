import re
from pathlib import Path

import pytest
from playwright.sync_api import expect

from umap.models import Map, TileLayer

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db

DATALAYER_DATA = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "name": "name poly",
            },
            "id": "gyNzM",
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [11.25, 53.585984],
                        [10.151367, 52.975108],
                        [12.689209, 52.167194],
                        [14.084473, 53.199452],
                        [12.634277, 53.618579],
                        [11.25, 53.585984],
                        [11.25, 53.585984],
                    ],
                ],
            },
        },
    ],
}


@pytest.fixture
def map_with_polygon(map, live_server):
    map.settings["properties"]["zoom"] = 6
    map.settings["geometry"] = {
        "type": "Point",
        "coordinates": [8.429, 53.239],
    }
    map.edit_status = Map.ANONYMOUS
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA)
    return map


def test_can_undo_redo_map_name_change(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    expect(page.locator(".edit-undo")).to_be_disabled()
    expect(page.locator(".edit-redo")).to_be_disabled()
    page.get_by_title("Edit map name and caption").click()
    name_input = page.locator('.map-metadata input[name="name"]')
    expect(name_input).to_be_visible()
    name_input.click()
    name_input.press("Control+a")
    name_input.fill("New map name")
    expect(page.locator(".edit-undo")).to_be_enabled()
    expect(page.locator(".edit-redo")).to_be_disabled()
    map_name = page.locator(".umap-main-edit-toolbox .map-name")
    expect(map_name).to_have_text("New map name")
    name_input.fill("New name again")
    expect(map_name).to_have_text("New name again")

    page.locator(".edit-undo").click()
    expect(map_name).to_have_text("New map name")
    expect(page.locator(".edit-undo")).to_be_enabled()
    expect(page.locator(".edit-redo")).to_be_enabled()

    page.locator(".edit-redo").click()
    expect(map_name).to_have_text("New name again")
    expect(page.locator(".edit-undo")).to_be_enabled()
    expect(page.locator(".edit-redo")).to_be_disabled()

    page.locator(".edit-undo").click()
    expect(map_name).to_have_text("New map name")
    expect(page.locator(".edit-undo")).to_be_enabled()
    expect(page.locator(".edit-redo")).to_be_enabled()


def test_can_undo_redo_layer_color_change(
    page, map_with_polygon, live_server, tilelayer
):
    page.goto(f"{live_server.url}{map_with_polygon.get_absolute_url()}?edit")

    expect(page.locator(".edit-undo")).to_be_disabled()
    expect(page.locator(".edit-redo")).to_be_disabled()
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit", exact=True).click()
    page.get_by_text("Shape properties").click()
    page.locator(".umap-field-color .define").click()
    expect(page.locator(".leaflet-overlay-pane path[fill='DarkBlue']")).to_have_count(1)
    page.get_by_title("DarkRed").first.click()
    expect(page.locator(".leaflet-overlay-pane path[fill='DarkRed']")).to_have_count(1)
    expect(page.locator(".edit-undo")).to_be_enabled()
    expect(page.locator(".edit-redo")).to_be_disabled()

    page.locator(".edit-undo").click()
    expect(page.locator(".leaflet-overlay-pane path[fill='DarkBlue']")).to_have_count(1)
    expect(page.locator(".leaflet-overlay-pane path[fill='DarkRed']")).to_have_count(0)
    expect(page.locator(".edit-undo")).to_be_disabled()
    expect(page.locator(".edit-redo")).to_be_enabled()

    page.locator(".edit-redo").click()
    expect(page.locator(".leaflet-overlay-pane path[fill='DarkRed']")).to_have_count(1)
    expect(page.locator(".leaflet-overlay-pane path[fill='DarkBlue']")).to_have_count(0)
    expect(page.locator(".edit-undo")).to_be_enabled()
    expect(page.locator(".edit-redo")).to_be_disabled()


def test_can_undo_redo_tilelayer_change(live_server, page, openmap, tilelayer):
    TileLayer.objects.create(
        url_template="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        attribution="OSM/Carto",
        name="Black Tiles",
    )
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    old_pattern = re.compile(
        r"https://[abc]{1}.tile.openstreetmap.fr/osmfr/\d+/\d+/\d+.png"
    )
    tiles = page.locator(".leaflet-tile-pane img")
    expect(tiles.first).to_have_attribute("src", old_pattern)

    new_pattern = re.compile(
        r"https://[abcd]{1}.basemaps.cartocdn.com/dark_all/\d+/\d+/\d+.png"
    )
    page.get_by_role("button", name="Change tilelayers").click()
    page.locator("li").filter(has_text="Black Tiles").get_by_role("img").click()

    tiles = page.locator(".leaflet-tile-pane img")
    expect(tiles.first).to_have_attribute("src", new_pattern)

    page.locator(".edit-undo").click()
    tiles = page.locator(".leaflet-tile-pane img")
    expect(tiles.first).to_have_attribute("src", old_pattern)

    page.locator(".edit-redo").click()
    tiles = page.locator(".leaflet-tile-pane img")
    expect(tiles.first).to_have_attribute("src", new_pattern)


def test_can_undo_redo_marker_drag(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new")

    marker = page.locator(".leaflet-marker-icon")
    map = page.locator("#map")

    # Create a marker
    page.get_by_title("Draw a marker").click()
    map.click(position={"x": 225, "y": 225})
    expect(marker).to_have_count(1)

    # Drag marker
    old_bbox = marker.bounding_box()
    marker.first.drag_to(map, target_position={"x": 250, "y": 250})
    assert marker.bounding_box() != old_bbox

    # Undo
    page.locator(".edit-undo").click()
    assert marker.bounding_box() == old_bbox

    # Redo
    page.locator(".edit-redo").click()
    assert marker.bounding_box() != old_bbox


def test_can_undo_redo_polygon_geometry_change(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new")

    # Click on the Draw a polygon button on a new map.
    page.get_by_title("Draw a polygon").click()

    polygon = page.locator("path[fill='DarkBlue']")
    expect(polygon).to_have_count(0)

    # Click on the map, it will create a polygon.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 100})

    # It is created on peerA, and should be on peerB
    expect(polygon).to_have_count(1)
    old_bbox = polygon.bounding_box()

    edited_vertex = page.locator(".leaflet-middle-icon:nth-child(3)").first
    edited_vertex.drag_to(map, target_position={"x": 250, "y": 250})
    page.keyboard.press("Escape")

    assert polygon.bounding_box() != old_bbox

    page.locator(".edit-undo").click()
    assert polygon.bounding_box() == old_bbox

    page.locator(".edit-redo").click()
    assert polygon.bounding_box() != old_bbox


def test_can_undo_redo_marker_create(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new")

    page.get_by_title("Open Browser").click()
    marker = page.locator(".leaflet-marker-icon")
    map = page.locator("#map")

    # Create a marker
    page.get_by_title("Draw a marker").click()
    map.click(position={"x": 600, "y": 100})
    expect(marker).to_have_count(1)
    expect(page.locator(".panel .datalayer")).to_have_count(1)

    page.locator(".edit-undo").click()
    expect(marker).to_have_count(0)
    # Layer still exists
    expect(page.locator(".panel .datalayer")).to_have_count(1)

    page.locator(".edit-undo").click()
    expect(page.locator(".panel .datalayer")).to_have_count(0)

    page.locator(".edit-redo").click()
    expect(page.locator(".panel .datalayer")).to_have_count(1)

    page.locator(".edit-redo").click()
    expect(marker).to_have_count(1)


def test_undo_redo_import(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/map/new/")
    page.get_by_title("Open Browser").click()

    page.get_by_title("Import data").click()
    file_input = page.locator("input[type='file']")
    with page.expect_file_chooser() as fc_info:
        file_input.click()
    file_chooser = fc_info.value
    path = Path(__file__).parent.parent / "fixtures/test_upload_data.json"
    file_chooser.set_files(path)
    page.get_by_role("button", name="Import data", exact=True).click()
    # Close the import panel
    page.keyboard.press("Escape")

    layers = page.locator(".umap-browser .datalayer")
    expect(layers).to_have_count(1)

    features_count = page.locator(".umap-browser .datalayer-counter")
    expect(features_count).to_have_text("(5)")

    page.locator(".edit-undo").click()
    expect(features_count).to_be_hidden()
    expect(layers).to_have_count(1)

    page.locator(".edit-undo").click()
    expect(layers).to_have_count(0)

    page.locator(".edit-redo").click()
    expect(layers).to_have_count(1)

    page.locator(".edit-redo").click()
    expect(features_count).to_have_text("(5)")
