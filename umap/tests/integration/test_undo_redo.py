import re
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image
from playwright.sync_api import expect

from umap.models import Map, TileLayer

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db

TILE_HEADERS = {
    "content_type": "image/png",
    "headers": {"Access-Control-Allow-Origin": "*"},
}


def colored_tile(color):
    buffer = BytesIO()
    Image.new("RGB", (256, 256), color).save(buffer, format="PNG")
    return buffer.getvalue()


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
    page, map_with_polygon, live_server, tilelayer, assert_screenshot
):
    page.goto(
        f"{live_server.url}{map_with_polygon.get_absolute_url()}?edit#6/53.109/12.162"
    )

    expect(page.locator(".edit-undo")).to_be_disabled()
    expect(page.locator(".edit-redo")).to_be_disabled()
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit", exact=True).click()
    page.get_by_text("Shape properties").click()
    page.locator(".umap-field-color .define").click()
    assert_screenshot(page, suffix="blue", ui=False)
    page.get_by_title("DarkRed").first.click()
    assert_screenshot(page, suffix="red", ui=False)
    expect(page.locator(".edit-undo")).to_be_enabled()
    expect(page.locator(".edit-redo")).to_be_disabled()

    page.locator(".edit-undo").click()
    assert_screenshot(page, suffix="blue", ui=False)
    expect(page.locator(".edit-undo")).to_be_disabled()
    expect(page.locator(".edit-redo")).to_be_enabled()

    page.locator(".edit-redo").click()
    assert_screenshot(page, suffix="red", ui=False)
    expect(page.locator(".edit-undo")).to_be_enabled()
    expect(page.locator(".edit-redo")).to_be_disabled()


def test_can_undo_redo_tilelayer_change(
    live_server, page, openmap, tilelayer, assert_screenshot
):
    TileLayer.objects.create(
        url_template="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        attribution="OSM/Carto",
        name="Black Tiles",
    )
    # Serve a different tile per layer, so the screenshots tell them apart.
    page.route(
        re.compile(r"https://[abc]{1}.tile.openstreetmap.fr/osmfr/.*"),
        lambda route: route.fulfill(body=colored_tile("green"), **TILE_HEADERS),
    )
    page.route(
        re.compile(r"https://[abcd]{1}.basemaps.cartocdn.com/dark_all/.*"),
        lambda route: route.fulfill(body=colored_tile("purple"), **TILE_HEADERS),
    )
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    assert_screenshot(page, suffix="old-tiles", ui=False)

    page.get_by_role("button", name="Change tilelayers").click()
    page.locator("li").filter(has_text="Black Tiles").get_by_text("Black Tiles").click()
    assert_screenshot(page, suffix="new-tiles", ui=False)

    page.locator(".edit-undo").click()
    assert_screenshot(page, suffix="old-tiles", ui=False)

    page.locator(".edit-redo").click()
    assert_screenshot(page, suffix="new-tiles", ui=False)


def test_can_undo_redo_marker_drag(live_server, page, tilelayer, assert_screenshot):
    page.goto(f"{live_server.url}/en/map/new")

    map = page.locator("#map")

    # Create a marker
    page.get_by_title("Draw a marker").click()
    map.click(position={"x": 225, "y": 225})
    # A selected feature renders highlighted, and undo does not restore the
    # selection: leave edit mode so every screenshot shares the same style.
    page.keyboard.press("Escape")
    assert_screenshot(page, suffix="created", ui=False)

    # Translate acts on the selection.
    map.click(position={"x": 225, "y": 215}, modifiers=["Shift"])
    expect(page.locator(".panel.right form input").first).to_be_focused()
    # Drag the marker, grabbing its icon, which sits above its anchor
    map.drag_to(
        map, source_position={"x": 225, "y": 215}, target_position={"x": 250, "y": 240}
    )
    page.keyboard.press("Escape")

    # Undo
    page.locator(".edit-undo").click()
    assert_screenshot(page, suffix="created", ui=False)

    # Redo
    page.locator(".edit-redo").click()
    assert_screenshot(page, suffix="moved", ui=False)


def test_can_undo_redo_polygon_geometry_change(
    live_server, page, tilelayer, assert_screenshot
):
    page.goto(f"{live_server.url}/en/map/new")

    # Click on the Draw a polygon button on a new map.
    page.get_by_title("Draw a polygon").click()

    # Click on the map, it will create a polygon.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 100})
    # A selected feature renders highlighted, and undo does not restore the
    # selection: leave edit mode so every screenshot shares the same style.
    page.keyboard.press("Escape")
    assert_screenshot(page, suffix="drawn", ui=False)

    # Move one of its vertices
    map.drag_to(
        map, source_position={"x": 200, "y": 200}, target_position={"x": 250, "y": 250}
    )

    page.locator(".edit-undo").click()
    assert_screenshot(page, suffix="drawn", ui=False)

    page.locator(".edit-redo").click()
    assert_screenshot(page, suffix="moved", ui=False)


def test_can_undo_redo_marker_create(live_server, page, tilelayer, wait_for_edit_mode):
    page.goto(f"{live_server.url}/en/map/new")
    wait_for_edit_mode(page)

    page.get_by_title("Open browser").click()
    # An empty layer has no counter at all.
    counter = page.locator(".umap-browser .datalayer-counter")
    map = page.locator("#map")

    # Create a marker
    page.get_by_title("Draw a marker").click()
    map.click(position={"x": 600, "y": 100})
    expect(counter).to_have_text("(1)")
    expect(page.locator(".panel .datalayer")).to_have_count(1)

    page.locator(".edit-undo").click()
    expect(counter).to_be_hidden()
    # Layer still exists
    expect(page.locator(".panel .datalayer")).to_have_count(1)

    page.locator(".edit-undo").click()
    expect(page.locator(".panel .datalayer")).to_have_count(0)

    page.locator(".edit-redo").click()
    expect(page.locator(".panel .datalayer")).to_have_count(1)

    page.locator(".edit-redo").click()
    expect(counter).to_have_text("(1)")


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


def test_can_undo_redo_datalayer_delete_with_parent(
    live_server, openmap, page, assert_screenshot
):
    openmap.settings["properties"]["onLoadPanel"] = "databrowser"
    openmap.save()
    root1 = DataLayerFactory(name="root 1", rank=0, map=openmap, data={})
    child1 = DataLayerFactory(
        name="child",
        rank=0,
        parent=root1,
        map=openmap,
        data={},
    )
    DataLayerFactory(
        name="grandchild",
        rank=0,
        parent=child1,
        map=openmap,
        data={
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [4, 48]},
                    "properties": {"name": "grandchild feature"},
                }
            ]
        },
    )
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#6/48/4")
    expect(page.locator(".panel.left").get_by_text("grandchild (1)")).to_be_visible()
    expect(page.locator(".panel.left").get_by_text("child", exact=True)).to_be_visible()
    assert_screenshot(page, suffix="with-feature", ui=False)

    # Delete child
    page.locator(f'summary[data-id="{child1.pk}"] .icon-delete').click()
    expect(page.locator(".panel.left").get_by_text("grandchild (1)")).to_be_hidden()
    expect(page.locator(".panel.left").get_by_text("child", exact=True)).to_be_hidden()
    assert_screenshot(page, suffix="deleted", ui=False)

    # Undo
    page.locator(".edit-undo").click()
    expect(page.locator(".panel.left").get_by_text("grandchild (1)")).to_be_visible()
    expect(page.locator(".panel.left").get_by_text("child", exact=True)).to_be_visible()
    assert_screenshot(page, suffix="with-feature", ui=False)


def test_can_undo_redo_datalayer_delete_with_children(
    live_server, openmap, page, assert_screenshot
):
    openmap.settings["properties"]["onLoadPanel"] = "databrowser"
    openmap.save()
    root1 = DataLayerFactory(name="root 1", rank=0, map=openmap, data={})
    child1 = DataLayerFactory(
        name="child",
        rank=0,
        parent=root1,
        map=openmap,
        data={},
    )
    DataLayerFactory(
        name="grandchild",
        rank=0,
        parent=child1,
        map=openmap,
        data={
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [4, 48]},
                    "properties": {"name": "grandchild feature"},
                }
            ]
        },
    )
    DataLayerFactory(
        name="child2",
        rank=0,
        parent=root1,
        map=openmap,
        data={
            "features": [
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [5, 48]},
                    "properties": {"name": "grandchild feature"},
                }
            ]
        },
    )
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#6/48/4")
    expect(page.locator(".panel.left").get_by_text("grandchild (1)")).to_be_visible()
    expect(page.locator(".panel.left").get_by_text("child2 (1)")).to_be_visible()
    expect(page.locator(".panel.left").get_by_text("child", exact=True)).to_be_visible()
    assert_screenshot(page, suffix="with-features", ui=False)

    # Delete parent
    page.locator(f'summary[data-id="{root1.pk}"] .icon-delete').click()
    expect(page.locator(".panel.left").get_by_text("grandchild (1)")).to_be_hidden()
    expect(page.locator(".panel.left").get_by_text("child2 (1)")).to_be_hidden()
    expect(page.locator(".panel.left").get_by_text("child", exact=True)).to_be_hidden()
    assert_screenshot(page, suffix="deleted", ui=False)

    # Undo
    page.locator(".edit-undo").click()
    expect(page.locator(".panel.left").get_by_text("grandchild (1)")).to_be_visible()
    expect(page.locator(".panel.left").get_by_text("child2 (1)")).to_be_visible()
    expect(page.locator(".panel.left").get_by_text("child", exact=True)).to_be_visible()
    assert_screenshot(page, suffix="with-features", ui=False)
