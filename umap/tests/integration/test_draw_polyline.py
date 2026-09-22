import platform

import pytest
from playwright.sync_api import expect

from .helpers import save_and_get_json

pytestmark = pytest.mark.django_db


def test_draw_polyline(page, live_server, tilelayer, assert_screenshot):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a line button on a new map.
    create_line = page.locator(".umap-edit-bar ").get_by_title("Draw a polyline")
    create_line.click()

    # The tool stays on for as long as the drawing is not finished.
    drawing = page.locator(".umap-edit-bar .drawing-tool.on")
    expect(drawing).to_have_count(1)

    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    expect(drawing).to_have_count(1)
    map.click(position={"x": 100, "y": 200})
    expect(drawing).to_have_count(1)
    map.click(position={"x": 100, "y": 100})
    expect(drawing).to_have_count(1)
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(drawing).to_have_count(0)
    assert_screenshot(page, ui=False)
    page.get_by_title("Open browser").click()
    page.locator(".umap-browser .datalayer").click()
    expect(page.locator(".umap-browser .feature.polyline")).to_have_count(1)


def test_can_delete_vertex(page, live_server, tilelayer, settings, assert_screenshot):
    settings.UMAP_ALLOW_ANONYMOUS = True
    modifier = "Meta" if platform.system() == "Darwin" else "Control"
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_title("Draw a polyline").click()
    map = page.locator("#map")
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 300, "y": 200})
    # Click again to finish
    map.click(position={"x": 300, "y": 200})

    # Modify only knows about a vertex it has seen under the pointer.
    map.hover(position={"x": 200, "y": 100})
    map.click(position={"x": 200, "y": 100}, modifiers=[modifier])
    expect(page.locator(".umap-popup")).to_be_hidden()
    page.wait_for_timeout(300)  # OL deletes on singleclick, 250ms after the click.
    assert_screenshot(page, ui=False)

    data = save_and_get_json(page)
    assert data["features"][0]["geometry"]["coordinates"] == [
        [
            -9.865234,
            53.160015,
        ],
        [
            -5.470703,
            53.160015,
        ],
    ]


def test_clicking_esc_should_finish_line(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a line button on a new map.
    create_line = page.locator(".umap-edit-bar ").get_by_title("Draw a polyline")
    create_line.click()
    drawing = page.locator(".umap-edit-bar .drawing-tool.on")
    expect(drawing).to_have_count(1)

    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    expect(drawing).to_have_count(1)
    # Click ESC to finish
    page.keyboard.press("Escape")
    expect(drawing).to_have_count(0)
    # Should have opened edit form panel
    expect(page.locator(".panel").get_by_text("Feature properties")).to_be_visible()
    page.get_by_title("Open browser").click()
    page.locator(".umap-browser .datalayer").click()
    expect(page.locator(".umap-browser .feature.polyline")).to_have_count(1)


def test_clicking_esc_should_delete_line_if_empty(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a line button on a new map.
    create_line = page.locator(".umap-edit-bar ").get_by_title("Draw a polyline")
    create_line.click()
    drawing = page.locator(".umap-edit-bar .drawing-tool.on")
    expect(drawing).to_have_count(1)

    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    # At this stage, the line as one element, it should not be created
    # on pressing esc, as invalid
    # Click ESC to finish
    page.keyboard.press("Escape")
    expect(drawing).to_have_count(0)
    # Should not have opened edit form panel
    expect(page.locator(".panel").get_by_text("Feature properties")).to_be_hidden()
    page.get_by_title("Open browser").click()
    expect(page.locator(".umap-browser .feature")).to_have_count(0)


def test_clicking_esc_should_delete_line_if_invalid(
    page, live_server, tilelayer, wait_for_loaded
):
    page.goto(f"{live_server.url}/en/map/new/")
    wait_for_loaded(page)

    # Click on the Draw a line button on a new map.
    create_line = page.locator(".umap-edit-bar ").get_by_title("Draw a polyline")
    create_line.click()
    drawing = page.locator(".umap-edit-bar .drawing-tool.on")
    expect(drawing).to_have_count(1)

    # At this stage, the line as no element, it should not be created
    # on pressing esc
    # Click ESC to finish
    page.keyboard.press("Escape")
    expect(drawing).to_have_count(0)
    # Should not have opened edit form panel
    expect(page.locator(".panel").get_by_text("Feature properties")).to_be_hidden()
    page.get_by_title("Open browser").click()
    expect(page.locator(".umap-browser .feature")).to_have_count(0)


def test_can_draw_multi(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
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
    add_shape.click()
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    page.keyboard.press("Escape")
    expect(add_shape).to_be_hidden()
    # Closing the panel empties it only once its animation is over, and dropping the
    # focused input from the DOM would close a context menu opened meanwhile.
    expect(page.locator(".panel.right form")).to_have_count(0)
    map.click(position={"x": 110, "y": 100}, button="right")
    expect(page.get_by_role("button", name="Transform to polygon")).to_be_hidden()
    expect(page.get_by_role("button", name="Delete this shape")).to_be_visible()

    # Both shapes belong to the same feature.
    page.get_by_title("Open browser").click()
    page.locator(".umap-browser .datalayer").click()
    expect(page.locator(".umap-browser .feature.polyline")).to_have_count(1)


def test_can_combine_two_simple_polylines(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_title("Draw a polyline").click()
    map = page.locator("#map")

    # Draw a first line
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 200})
    # Click again to finish
    map.click(position={"x": 100, "y": 200})

    # Draw another line, which remains the selected one
    page.get_by_title("Draw a polyline").click()
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})

    # The first line takes the shape of the selected one, which is deleted
    expect(page.locator(".panel.right form input").first).to_be_focused()
    map.click(position={"x": 110, "y": 100}, button="right")
    page.get_by_role("button", name="Combine features").click()
    data = save_and_get_json(page)
    assert len(data["features"]) == 1
    assert data["features"][0]["geometry"] == {
        "type": "MultiLineString",
        "coordinates": [
            [[-7.667969, 54.457332], [-9.865234, 54.457332], [-9.865234, 53.160015]],
            [[-6.569336, 52.496228], [-7.667969, 52.496228], [-7.667969, 53.160015]],
        ],
    }


def test_can_combine_multi_and_simple_polylines(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_title("Draw a polyline").click()
    map = page.locator("#map")

    # Draw a multi line
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 200})
    # Click again to finish
    map.click(position={"x": 100, "y": 200})
    page.get_by_title("Add a line to the current multi").click()
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})

    # Draw another line, which remains the selected one
    page.get_by_title("Draw a polyline").click()
    map.click(position={"x": 350, "y": 350})
    map.click(position={"x": 300, "y": 350})
    map.click(position={"x": 300, "y": 300})
    # Click again to finish
    map.click(position={"x": 300, "y": 300})

    # The multi takes the shape of the selected line, which is deleted
    expect(page.locator(".panel.right form input").first).to_be_focused()
    map.click(position={"x": 110, "y": 100}, button="right")
    page.get_by_role("button", name="Combine features").click()
    data = save_and_get_json(page)
    assert len(data["features"]) == 1
    assert data["features"][0]["geometry"] == {
        "type": "MultiLineString",
        "coordinates": [
            [[-7.667969, 54.457332], [-9.865234, 54.457332], [-9.865234, 53.160015]],
            [[-6.569336, 52.496228], [-7.667969, 52.496228], [-7.667969, 53.160015]],
            [[-4.37207, 51.138072], [-5.470703, 51.138072], [-5.470703, 51.822268]],
        ],
    }


def test_can_extract_shape(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    lines = page.locator(".umap-browser .feature.polyline")
    page.get_by_title("Draw a polylin").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 200})
    # Click again to finish
    map.click(position={"x": 100, "y": 200})
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
    # Adding a shape moves the focus asynchronously, which would close a context
    # menu opened meanwhile.
    page.wait_for_timeout(300)
    map.click(position={"x": 110, "y": 100}, button="right")
    expect(extract_button).to_be_visible()
    extract_button.click()
    page.get_by_title("Open browser").click()
    page.locator(".umap-browser .datalayer").click()
    expect(lines).to_have_count(2)


def test_can_clone_polyline(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_title("Draw a polyline").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 200})
    # Click again to finish
    map.click(position={"x": 100, "y": 200})
    # When panel opens, it will have the focus, thus close the contextmenu,
    # so wait for it before trying to right click (and prevent a race).
    expect(page.locator(".panel.right form input").first).to_be_focused()
    map.click(position={"x": 110, "y": 100}, button="right")
    page.get_by_role("button", name="Clone this feature").click()
    data = save_and_get_json(page)
    assert len(data["features"]) == 2
    assert data["features"][0]["geometry"]["type"] == "LineString"
    assert data["features"][0]["geometry"] == data["features"][1]["geometry"]
    assert data["features"][0]["properties"] == data["features"][1]["properties"]


def test_can_transform_polyline_to_polygon(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    lines = page.locator(".umap-browser .feature.polyline")
    polygons = page.locator(".umap-browser .feature.polygon")
    page.get_by_title("Draw a polyline").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 100, "y": 100})
    map.click(position={"x": 100, "y": 200})
    # Click again to finish
    map.click(position={"x": 100, "y": 200})
    # When panel opens, it will have the focus, thus close the contextmenu,
    # so wait for it before trying to right click (and prevent a race).
    expect(page.locator(".panel.right form input").first).to_be_focused()

    map.click(position={"x": 110, "y": 100}, button="right")
    page.get_by_role("button", name="Transform to polygon").click()
    page.get_by_title("Open browser").click()
    page.locator(".umap-browser .datalayer").click()
    expect(polygons).to_have_count(1)
    expect(lines).to_have_count(0)
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
    # When panel opens, it will have the focus, thus close the contextmenu,
    # so wait for it before trying to right click (and prevent a race).
    expect(page.locator(".panel.right form input").first).to_be_focused()

    # Now split the line
    map.click(position={"x": 100, "y": 100}, button="right")
    page.get_by_role("button", name="Split line").click()

    # Delete one of the two shapes
    map.click(position={"x": 125, "y": 100}, button="right")
    expect(page.get_by_role("button", name="Delete this shape")).to_be_visible()
    page.get_by_role("button", name="Delete this shape").click()
    data = save_and_get_json(page)
    assert len(data["features"]) == 1
    assert data["features"][0]["geometry"]["type"] == "LineString"
    assert data["features"][0]["geometry"]["coordinates"] == [
        [
            -9.865234,
            54.457332,
        ],
        [
            -9.865234,
            53.160015,
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

    # Adding a shape moves the focus asynchronously, which would close a context
    # menu opened meanwhile.
    page.wait_for_timeout(300)
    map.click(button="right", position={"x": 100, "y": 120})
    expect(page.get_by_role("button", name="Merge lines")).to_be_visible()
    page.get_by_role("button", name="Merge lines").click()
    data = save_and_get_json(page)
    assert len(data["features"]) == 1
    assert data["features"][0]["geometry"]["type"] == "LineString"
    assert data["features"][0]["geometry"]["coordinates"] == [
        [
            -9.865234,
            54.457332,
        ],
        [
            -9.865234,
            53.160015,
        ],
        [
            -7.667969,
            54.457332,
        ],
    ]
