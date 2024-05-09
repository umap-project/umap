import json
import re
from pathlib import Path

import pytest
from playwright.sync_api import expect

from umap.models import DataLayer

pytestmark = pytest.mark.django_db


def save_and_get_json(page):
    with page.expect_response(re.compile(r".*/datalayer/create/.*")):
        page.get_by_role("button", name="Save").click()
    datalayer = DataLayer.objects.last()
    return json.loads(Path(datalayer.geojson.path).read_text())


def test_draw_polygon(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a polygon button on a new map.
    create_line = page.locator(".leaflet-control-toolbar ").get_by_title(
        "Draw a polygon"
    )
    create_line.click()

    # Check no polygon is present by default.
    # We target with the color, because there is also the drawing line guide (dash-array)
    # around
    lines = page.locator(".leaflet-overlay-pane path[stroke='DarkBlue']")
    guide = page.locator(".leaflet-overlay-pane > svg > g > path")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)

    # Click on the map, it will create a polygon.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(1)
    map.click(position={"x": 100, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(2)
    map.click(position={"x": 100, "y": 100})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(2)
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(0)


def test_clicking_esc_should_finish_polygon(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a polygon button on a new map.
    create_line = page.locator(".leaflet-control-toolbar ").get_by_title(
        "Draw a polygon"
    )
    create_line.click()

    # Check no polygon is present by default.
    # We target with the color, because there is also the drawing line guide (dash-array)
    # around
    lines = page.locator(".leaflet-overlay-pane path[stroke='DarkBlue']")
    guide = page.locator(".leaflet-overlay-pane > svg > g > path")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)

    # Click on the map, it will create a polygon.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(1)
    map.click(position={"x": 100, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(2)
    map.click(position={"x": 100, "y": 100})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(2)
    # Click ESC to finish
    page.keyboard.press("Escape")
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(0)
    # Should have opened edit form panel
    expect(page.locator(".panel").get_by_text("Feature properties")).to_be_visible()


def test_clicking_esc_should_delete_polygon_if_empty(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a polygon button on a new map.
    create_line = page.locator(".leaflet-control-toolbar ").get_by_title(
        "Draw a polygon"
    )
    create_line.click()

    # Check no polygon is present by default.
    # We target with the color, because there is also the drawing line guide (dash-array)
    # around
    lines = page.locator(".leaflet-overlay-pane path[stroke='DarkBlue']")
    guide = page.locator(".leaflet-overlay-pane > svg > g > path")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)

    # Click ESC to finish, no polygon should have been created
    page.keyboard.press("Escape")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)
    # Should not have opened edit form panel
    expect(page.locator(".panel").get_by_text("Feature properties")).to_be_hidden()


def test_clicking_esc_should_delete_polygon_if_invalid(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a polygon button on a new map.
    create_line = page.locator(".leaflet-control-toolbar ").get_by_title(
        "Draw a polygon"
    )
    create_line.click()

    # Check no polygon is present by default.
    # We target with the color, because there is also the drawing line guide (dash-array)
    # around
    lines = page.locator(".leaflet-overlay-pane path[stroke='DarkBlue']")
    guide = page.locator(".leaflet-overlay-pane > svg > g > path")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)

    # Click on the map twice, it will start a polygon.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(1)
    map.click(position={"x": 100, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(2)
    # Click ESC to finish, the polygon is invalid, it should not be persisted
    page.keyboard.press("Escape")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)
    # Should not have opened edit form panel
    expect(page.locator(".panel").get_by_text("Feature properties")).to_be_hidden()


def test_can_draw_multi(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    polygons = page.locator(".leaflet-overlay-pane path")
    expect(polygons).to_have_count(0)
    multi_button = page.get_by_title("Add a polygon to the current multi")
    expect(multi_button).to_be_hidden()
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 150, "y": 100})
    map.click(position={"x": 150, "y": 150})
    map.click(position={"x": 100, "y": 150})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(multi_button).to_be_visible()
    expect(polygons).to_have_count(1)
    multi_button.click()
    map.click(position={"x": 250, "y": 200})
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    expect(polygons).to_have_count(1)
    page.keyboard.press("Escape")
    expect(multi_button).to_be_hidden()
    polygons.first.click(button="right", position={"x": 10, "y": 10})
    expect(page.get_by_role("link", name="Transform to lines")).to_be_hidden()
    expect(page.get_by_role("link", name="Remove shape from the multi")).to_be_visible()


def test_can_draw_hole(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    page.get_by_title("Draw a polygon").click()

    polygons = page.locator(".leaflet-overlay-pane path")
    vertices = page.locator(".leaflet-vertex-icon")

    # Click on the map, it will create a polygon.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(polygons).to_have_count(1)
    expect(vertices).to_have_count(4)

    # First vertex of the hole will be created here
    map.click(position={"x": 180, "y": 120})
    page.get_by_role("link", name="Start a hole here").click()
    map.click(position={"x": 180, "y": 180})
    map.click(position={"x": 120, "y": 180})
    map.click(position={"x": 120, "y": 120})
    # Click again to finish
    map.click(position={"x": 120, "y": 120})
    expect(polygons).to_have_count(1)
    expect(vertices).to_have_count(8)
    # Click on the polygon but not in the hole
    polygons.first.click(button="right", position={"x": 10, "y": 10})
    expect(page.get_by_role("link", name="Transform to lines")).to_be_hidden()


def test_can_transfer_shape_from_simple_polygon(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    polygons = page.locator(".leaflet-overlay-pane path")
    expect(polygons).to_have_count(0)
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")

    # Draw a first polygon
    map.click(position={"x": 150, "y": 100})
    map.click(position={"x": 150, "y": 150})
    map.click(position={"x": 100, "y": 150})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(polygons).to_have_count(1)

    # Draw another polygon
    page.get_by_title("Draw a polygon").click()
    map.click(position={"x": 250, "y": 200})
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    expect(polygons).to_have_count(2)

    # Now that polygon 2 is selected, right click on first one
    # and transfer shape
    polygons.first.click(position={"x": 20, "y": 20}, button="right")
    page.get_by_role("link", name="Transfer shape to edited feature").click()
    expect(polygons).to_have_count(1)


def test_can_extract_shape(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    polygons = page.locator(".leaflet-overlay-pane path")
    expect(polygons).to_have_count(0)
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 150, "y": 100})
    map.click(position={"x": 150, "y": 150})
    map.click(position={"x": 100, "y": 150})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(polygons).to_have_count(1)
    extract_button = page.get_by_role("link", name="Extract shape to separate feature")
    expect(extract_button).to_be_hidden()
    page.get_by_title("Add a polygon to the current multi").click()
    map.click(position={"x": 250, "y": 200})
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    expect(polygons).to_have_count(1)
    polygons.first.click(position={"x": 20, "y": 20}, button="right")
    extract_button.click()
    expect(polygons).to_have_count(2)


def test_cannot_transfer_shape_to_line(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    polygons = page.locator(".leaflet-overlay-pane path")
    expect(polygons).to_have_count(0)
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 150, "y": 100})
    map.click(position={"x": 150, "y": 150})
    map.click(position={"x": 100, "y": 150})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(polygons).to_have_count(1)
    extract_button = page.get_by_role("link", name="Extract shape to separate feature")
    polygons.first.click(position={"x": 20, "y": 20}, button="right")
    expect(extract_button).to_be_hidden()
    page.get_by_title("Draw a polyline").click()
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    expect(polygons).to_have_count(2)
    polygons.first.click(position={"x": 20, "y": 20}, button="right")
    expect(extract_button).to_be_hidden()


def test_cannot_transfer_shape_to_marker(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    polygons = page.locator(".leaflet-overlay-pane path")
    expect(polygons).to_have_count(0)
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 150, "y": 100})
    map.click(position={"x": 150, "y": 150})
    map.click(position={"x": 100, "y": 150})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(polygons).to_have_count(1)
    extract_button = page.get_by_role("link", name="Extract shape to separate feature")
    polygons.first.click(position={"x": 20, "y": 20}, button="right")
    expect(extract_button).to_be_hidden()
    page.get_by_title("Draw a marker").click()
    map.click(position={"x": 250, "y": 200})
    expect(polygons).to_have_count(1)
    polygons.first.click(position={"x": 20, "y": 20}, button="right")
    expect(extract_button).to_be_hidden()


def test_can_clone_polygon(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    polygons = page.locator(".leaflet-overlay-pane path")
    expect(polygons).to_have_count(0)
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(polygons).to_have_count(1)
    polygons.first.click(button="right")
    page.get_by_role("link", name="Clone this feature").click()
    expect(polygons).to_have_count(2)
    data = save_and_get_json(page)
    assert len(data["features"]) == 2
    assert data["features"][0]["geometry"]["type"] == "Polygon"
    assert data["features"][0]["geometry"] == data["features"][1]["geometry"]


def test_can_transform_polygon_to_line(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    paths = page.locator(".leaflet-overlay-pane path")
    polygons = page.locator(".leaflet-overlay-pane path[fill='DarkBlue']")
    expect(polygons).to_have_count(0)
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(polygons).to_have_count(1)
    expect(paths).to_have_count(1)
    polygons.first.click(button="right")
    page.get_by_role("link", name="Transform to lines").click()
    # No more polygons (will fill), but one path, it must be a line
    expect(polygons).to_have_count(0)
    expect(paths).to_have_count(1)
    data = save_and_get_json(page)
    assert len(data["features"]) == 1
    assert data["features"][0]["geometry"]["type"] == "LineString"
