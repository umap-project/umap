import pytest
from playwright.sync_api import expect

from .helpers import save_and_get_json

pytestmark = pytest.mark.django_db


def test_draw_polyline(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a line button on a new map.
    create_line = page.locator(".umap-edit-bar ").get_by_title("Draw a polyline")
    create_line.click()

    # Check no line is present by default.
    # We target with the color, because there is also the drawing line guide (dash-array)
    # around
    lines = page.locator(".leaflet-overlay-pane path[stroke='DarkBlue']")
    guide = page.locator(".leaflet-overlay-pane > svg > g > path")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)

    # Click on the map, it will create a line.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(1)
    map.click(position={"x": 100, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(1)
    map.click(position={"x": 100, "y": 100})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(1)
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(0)


def test_clicking_esc_should_finish_line(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a line button on a new map.
    create_line = page.locator(".umap-edit-bar ").get_by_title("Draw a polyline")
    create_line.click()

    # Check no line is present by default.
    # We target with the color, because there is also the drawing line guide (dash-array)
    # around
    lines = page.locator(".leaflet-overlay-pane path[stroke='DarkBlue']")
    guide = page.locator(".leaflet-overlay-pane > svg > g > path")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)

    # Click on the map, it will create a line.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(1)
    map.click(position={"x": 100, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(1)
    map.click(position={"x": 100, "y": 100})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(1)
    # Click ESC to finish
    page.keyboard.press("Escape")
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(0)
    # Should have opened edit form panel
    expect(page.locator(".panel").get_by_text("Feature properties")).to_be_visible()


def test_clicking_esc_should_delete_line_if_empty(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a line button on a new map.
    create_line = page.locator(".umap-edit-bar ").get_by_title("Draw a polyline")
    create_line.click()

    # Check no line is present by default.
    # We target with the color, because there is also the drawing line guide (dash-array)
    # around
    lines = page.locator(".leaflet-overlay-pane path[stroke='DarkBlue']")
    guide = page.locator(".leaflet-overlay-pane > svg > g > path")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)

    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    # At this stage, the line as one element, it should not be created
    # on pressing esc, as invalid
    # Click ESC to finish
    page.keyboard.press("Escape")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)
    # Should not have opened edit form panel
    expect(page.locator(".panel").get_by_text("Feature properties")).to_be_hidden()


def test_clicking_esc_should_delete_line_if_invalid(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a line button on a new map.
    create_line = page.locator(".umap-edit-bar ").get_by_title("Draw a polyline")
    create_line.click()

    # Check no line is present by default.
    # We target with the color, because there is also the drawing line guide (dash-array)
    # around
    lines = page.locator(".leaflet-overlay-pane path[stroke='DarkBlue']")
    guide = page.locator(".leaflet-overlay-pane > svg > g > path")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)

    # At this stage, the line as no element, it should not be created
    # on pressing esc
    # Click ESC to finish
    page.keyboard.press("Escape")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)
    # Should not have opened edit form panel
    expect(page.locator(".panel").get_by_text("Feature properties")).to_be_hidden()


def test_can_draw_multi(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    lines = page.locator(".leaflet-overlay-pane path")
    expect(lines).to_have_count(0)
    add_shape = page.get_by_title("Add a line to the current multi")
    expect(add_shape).to_be_hidden()
    page.get_by_title("Draw a polyline").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 200})
    # Click again to finish
    map.click(position={"x": 100, "y": 200})
    expect(add_shape).to_be_visible()
    expect(lines).to_have_count(1)
    add_shape.click()
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    expect(lines).to_have_count(1)
    page.keyboard.press("Escape")
    expect(add_shape).to_be_hidden()
    lines.first.click(button="right", position={"x": 10, "y": 1})
    expect(page.get_by_role("button", name="Transform to polygon")).to_be_hidden()
    expect(page.get_by_role("button", name="Delete this shape")).to_be_visible()


def test_can_transfer_shape_from_simple_polyline(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    lines = page.locator(".leaflet-overlay-pane path")
    expect(lines).to_have_count(0)
    page.get_by_title("Draw a polyline").click()
    map = page.locator("#map")

    # Draw a first line
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 200})
    # Click again to finish
    map.click(position={"x": 100, "y": 200})
    expect(lines).to_have_count(1)

    # Draw another line
    page.get_by_title("Draw a polyline").click()
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    expect(lines).to_have_count(2)

    # Now that line 2 is selected, right click on first one
    # and transfer shape
    lines.first.click(position={"x": 10, "y": 1}, button="right")
    page.get_by_role("button", name="Transfer shape to edited feature").click()
    expect(lines).to_have_count(1)


def test_can_transfer_shape_from_multi(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    lines = page.locator(".leaflet-overlay-pane path")
    expect(lines).to_have_count(0)
    page.get_by_title("Draw a polyline").click()
    map = page.locator("#map")

    # Draw a multi line
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 200})
    # Click again to finish
    map.click(position={"x": 100, "y": 200})
    expect(lines).to_have_count(1)
    page.get_by_title("Add a line to the current multi").click()
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    expect(lines).to_have_count(1)

    # Draw another line
    page.get_by_title("Draw a polyline").click()
    map.click(position={"x": 350, "y": 350})
    map.click(position={"x": 300, "y": 350})
    map.click(position={"x": 300, "y": 300})
    # Click again to finish
    map.click(position={"x": 300, "y": 300})
    expect(lines).to_have_count(2)

    # Now that line 2 is selected, right click on first one
    # and transfer shape
    lines.first.click(position={"x": 10, "y": 1}, button="right")
    page.get_by_role("button", name="Transfer shape to edited feature").click()
    expect(lines).to_have_count(2)
    data = save_and_get_json(page)
    assert data["features"][0]["geometry"] == {
        "coordinates": [
            [-6.569824, 52.49616],
            [-7.668457, 52.49616],
            [-7.668457, 53.159947],
        ],
        "type": "LineString",
    }
    assert data["features"][1]["geometry"] == {
        "coordinates": [
            [[-4.372559, 51.138001], [-5.471191, 51.138001], [-5.471191, 51.822198]],
            [[-7.668457, 54.457267], [-9.865723, 54.457267], [-9.865723, 53.159947]],
        ],
        "type": "MultiLineString",
    }


def test_can_extract_shape(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    lines = page.locator(".leaflet-overlay-pane path")
    expect(lines).to_have_count(0)
    page.get_by_title("Draw a polylin").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 200})
    # Click again to finish
    map.click(position={"x": 100, "y": 200})
    expect(lines).to_have_count(1)
    extract_button = page.get_by_role(
        "button", name="Extract shape to separate feature"
    )
    expect(extract_button).to_be_hidden()
    page.get_by_title("Add a line to the current multi").click()
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    expect(lines).to_have_count(1)
    lines.first.click(position={"x": 10, "y": 1}, button="right")
    extract_button.click()
    expect(lines).to_have_count(2)


def test_can_clone_polyline(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    lines = page.locator(".leaflet-overlay-pane path")
    expect(lines).to_have_count(0)
    page.get_by_title("Draw a polyline").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 200})
    # Click again to finish
    map.click(position={"x": 100, "y": 200})
    expect(lines).to_have_count(1)
    lines.first.click(position={"x": 10, "y": 1}, button="right")
    page.get_by_role("button", name="Clone this feature").click()
    expect(lines).to_have_count(2)
    data = save_and_get_json(page)
    assert len(data["features"]) == 2
    assert data["features"][0]["geometry"]["type"] == "LineString"
    assert data["features"][0]["geometry"] == data["features"][1]["geometry"]
    assert data["features"][0]["properties"] == data["features"][1]["properties"]


def test_can_transform_polyline_to_polygon(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    paths = page.locator(".leaflet-overlay-pane path")
    # Paths with fill
    polygons = page.locator(".leaflet-overlay-pane path[fill='DarkBlue']")
    expect(paths).to_have_count(0)
    page.get_by_title("Draw a polyline").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 200})
    # Click again to finish
    map.click(position={"x": 100, "y": 200})
    expect(paths).to_have_count(1)
    expect(polygons).to_have_count(0)
    paths.first.click(position={"x": 10, "y": 1}, button="right")
    page.get_by_role("button", name="Transform to polygon").click()
    expect(polygons).to_have_count(1)
    expect(paths).to_have_count(1)
    data = save_and_get_json(page)
    assert len(data["features"]) == 1
    assert data["features"][0]["geometry"]["type"] == "Polygon"


def test_can_delete_shape_using_toolbar(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_title("Draw a polyline").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 200})

    # Now split the line
    map.click(position={"x": 100, "y": 100}, button="right")
    page.get_by_role("button", name="Split line").click()

    # Delete part of it
    map.click(position={"x": 125, "y": 100}, button="right")
    page.get_by_role("button", name="Delete this shape").click()
    data = save_and_get_json(page)
    assert len(data["features"]) == 1
    assert data["features"][0]["geometry"]["type"] == "LineString"
    assert data["features"][0]["geometry"]["coordinates"] == [
        [
            -9.865723,
            54.457267,
        ],
        [
            -9.865723,
            53.159947,
        ],
    ]


def test_can_merge_lines(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_title("Draw a polyline").click()
    map = page.locator("#map")
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 200})

    page.get_by_title("Add a line to the current multi").click()
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 200, "y": 200})

    # Glue end nodes
    map.drag_to(
        map, source_position={"x": 200, "y": 200}, target_position={"x": 100, "y": 200}
    )

    # Right click and merge nodes
    map.click(button="right", position={"x": 100, "y": 120})
    page.get_by_role("button", name="Merge lines").click()
    data = save_and_get_json(page)
    assert len(data["features"]) == 1
    assert data["features"][0]["geometry"]["type"] == "LineString"
    assert data["features"][0]["geometry"]["coordinates"] == [
        [
            -9.865723,
            54.457267,
        ],
        [
            -9.865723,
            53.159947,
        ],
        [
            -7.668457,
            54.457267,
        ],
    ]
