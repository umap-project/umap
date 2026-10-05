import pytest
from playwright.sync_api import expect

from .helpers import save_and_get_json

pytestmark = pytest.mark.django_db


def test_draw_polygon(page, live_server, tilelayer, assert_screenshot):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a polygon button on a new map.
    create_path = page.locator(".umap-edit-bar").get_by_title("Draw a polygon")
    create_path.click()

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
    expect(page.locator(".umap-browser .feature.polygon")).to_have_count(1)


def test_clicking_esc_should_finish_polygon(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a polygon button on a new map.
    create_path = page.locator(".umap-edit-bar ").get_by_title("Draw a polygon")
    create_path.click()
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
    expect(page.locator(".umap-browser .feature.polygon")).to_have_count(1)


def test_clicking_esc_should_delete_polygon_if_empty(
    page, live_server, tilelayer, wait_for_loaded
):
    page.goto(f"{live_server.url}/en/map/new/")
    wait_for_loaded(page)

    # Click on the Draw a polygon button on a new map.
    create_path = page.locator(".umap-edit-bar ").get_by_title("Draw a polygon")
    create_path.click()
    drawing = page.locator(".umap-edit-bar .drawing-tool.on")
    expect(drawing).to_have_count(1)

    # Click ESC to finish, no polygon should have been created
    page.keyboard.press("Escape")
    expect(drawing).to_have_count(0)
    # Should not have opened edit form panel
    expect(page.locator(".panel").get_by_text("Feature properties")).to_be_hidden()
    page.get_by_title("Open browser").click()
    expect(page.locator(".umap-browser .feature")).to_have_count(0)


def test_clicking_esc_should_delete_polygon_if_invalid(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a polygon button on a new map.
    create_path = page.locator(".umap-edit-bar ").get_by_title("Draw a polygon")
    create_path.click()
    drawing = page.locator(".umap-edit-bar .drawing-tool.on")
    expect(drawing).to_have_count(1)

    # Click on the map twice, it will start a polygon.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    expect(drawing).to_have_count(1)
    # Click ESC to finish, the polygon is invalid, it should not be persisted
    page.keyboard.press("Escape")
    expect(drawing).to_have_count(0)
    # Should not have opened edit form panel
    expect(page.locator(".panel").get_by_text("Feature properties")).to_be_hidden()
    page.get_by_title("Open browser").click()
    expect(page.locator(".umap-browser .feature")).to_have_count(0)


def test_can_draw_multi(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
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
    multi_button.click()
    map.click(position={"x": 250, "y": 200})
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    page.keyboard.press("Escape")
    expect(multi_button).to_be_hidden()
    # Wait for the panel to be fully closed, otherwise it will close the contextmenu
    # we are opening (panel closes => removes DOM => removes focused input =>
    # fires focusout => closes contextmenu)
    expect(page.locator(".panel.right form")).to_have_count(0)
    map.click(position={"x": 110, "y": 110}, button="right")
    expect(page.get_by_role("button", name="Transform to lines")).to_be_hidden()
    expect(page.get_by_role("button", name="Delete this shape")).to_be_visible()

    # Both shapes belong to the same feature.
    page.get_by_title("Open browser").click()
    page.locator(".umap-browser .datalayer").click()
    expect(page.locator(".umap-browser .feature.polygon")).to_have_count(1)


def test_can_draw_hole(page, live_server, tilelayer, assert_screenshot):
    page.goto(f"{live_server.url}/en/map/new/")

    page.get_by_title("Draw a polygon").click()

    # Click on the map, it will create a polygon.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    assert_screenshot(page, suffix="without-hole", ui=False)

    page.wait_for_timeout(350)  # Time for the panel animation to finish
    map.click(position={"x": 180, "y": 120}, button="right")
    page.get_by_role("button", name="Start a hole here").click()
    map.click(position={"x": 180, "y": 180})
    map.click(position={"x": 120, "y": 180})
    map.click(position={"x": 120, "y": 120})
    # Click again to finish
    map.click(position={"x": 120, "y": 120})
    assert_screenshot(page, suffix="with-hole", ui=False)
    # Click on the polygon but not in the hole
    map.click(position={"x": 110, "y": 110}, button="right")
    expect(page.get_by_role("button", name="Transform to lines")).to_be_hidden()


def test_can_combine_two_simple_polygons(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")

    # Draw a first polygon
    map.click(position={"x": 150, "y": 100})
    map.click(position={"x": 150, "y": 150})
    map.click(position={"x": 100, "y": 150})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})

    # Draw another polygon, which remains the selected one
    page.get_by_title("Draw a polygon").click()
    map.click(position={"x": 250, "y": 200})
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})

    # The first polygon takes the shape of the selected one, which is deleted
    expect(page.locator(".panel.right form input").first).to_be_focused()
    map.click(position={"x": 125, "y": 125}, button="right")
    page.get_by_role("button", name="Combine features").click()
    data = save_and_get_json(page)
    assert len(data["features"]) == 1
    assert data["features"][0]["geometry"]["type"] == "MultiPolygon"


def test_can_extract_shape(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 150, "y": 100})
    map.click(position={"x": 150, "y": 150})
    map.click(position={"x": 100, "y": 150})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    extract_button = page.get_by_role(
        "button", name="Extract shape to separate feature"
    )
    expect(extract_button).to_be_hidden()
    page.get_by_title("Add a polygon to the current multi").click()
    map.click(position={"x": 250, "y": 200})
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    # Adding a shape moves the focus asynchronously, which would close a context
    # menu opened meanwhile.
    page.wait_for_timeout(300)
    map.click(position={"x": 125, "y": 125}, button="right")
    expect(extract_button).to_be_visible()
    extract_button.click()
    data = save_and_get_json(page)
    assert len(data["features"]) == 2
    assert data["features"][0]["geometry"]["type"] == "Polygon"
    assert data["features"][1]["geometry"]["type"] == "Polygon"
    assert data["features"][0]["geometry"]["coordinates"] == [
        [
            [-6.569336, 53.160015],
            [-6.569336, 52.496228],
            [-7.667969, 52.496228],
            [-7.667969, 53.160015],
            [-6.569336, 53.160015],
        ],
    ]
    assert data["features"][1]["geometry"]["coordinates"] == [
        [
            [-8.766602, 54.457332],
            [-8.766602, 53.813693],
            [-9.865234, 53.813693],
            [-9.865234, 54.457332],
            [-8.766602, 54.457332],
        ],
    ]


def test_cannot_combine_polygon_with_line(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 150, "y": 100})
    map.click(position={"x": 150, "y": 150})
    map.click(position={"x": 100, "y": 150})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})

    # Draw a line, which remains the selected one
    page.get_by_title("Draw a polyline").click()
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})

    expect(page.locator(".panel.right form input").first).to_be_focused()
    map.click(position={"x": 125, "y": 125}, button="right")
    expect(page.get_by_role("button", name="Transform to lines")).to_be_visible()
    expect(page.get_by_role("button", name="Combine features")).to_be_hidden()


def test_cannot_combine_polygon_with_marker(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 150, "y": 100})
    map.click(position={"x": 150, "y": 150})
    map.click(position={"x": 100, "y": 150})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})

    # Draw a marker, which remains the selected one
    page.get_by_title("Draw a marker").click()
    map.click(position={"x": 250, "y": 200})

    expect(page.locator(".panel.right form input").first).to_be_focused()
    map.click(position={"x": 125, "y": 125}, button="right")
    expect(page.get_by_role("button", name="Transform to lines")).to_be_visible()
    expect(page.get_by_role("button", name="Combine features")).to_be_hidden()


def test_can_clone_polygon(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(page.locator(".panel.right form input").first).to_be_focused()
    map.click(position={"x": 150, "y": 150}, button="right")
    page.get_by_role("button", name="Clone this feature").click()
    data = save_and_get_json(page)
    assert len(data["features"]) == 2
    assert data["features"][0]["geometry"]["type"] == "Polygon"
    assert data["features"][0]["geometry"] == data["features"][1]["geometry"]


def test_can_transform_polygon_to_line(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(page.locator(".panel.right form input").first).to_be_focused()
    map.click(position={"x": 150, "y": 150}, button="right")
    page.get_by_role("button", name="Transform to lines").click()
    page.get_by_title("Open browser").click()
    page.locator(".umap-browser .datalayer").click()
    expect(page.locator(".umap-browser .feature.polygon")).to_have_count(0)
    expect(page.locator(".umap-browser .feature.polyline")).to_have_count(1)
    data = save_and_get_json(page)
    assert len(data["features"]) == 1
    assert data["features"][0]["geometry"]["type"] == "LineString"


def test_can_draw_a_polygon_and_invert_it(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    page.get_by_text("Advanced properties").click()
    page.get_by_text("Display the polygon inverted").click()
    data = save_and_get_json(page)
    # Close save message
    page.get_by_role("dialog").get_by_role("button", name="Close").click()
    assert len(data["features"]) == 1
    assert data["features"][0]["geometry"]["type"] == "Polygon"
    assert data["features"][0]["geometry"]["coordinates"] == [
        [
            [-7.667969, 54.457332],
            [-7.667969, 53.160015],
            [-9.865234, 53.160015],
            [-9.865234, 54.457332],
            [-7.667969, 54.457332],
        ],
    ]

    page.get_by_role("button", name="View", exact=True).click()
    popup = page.locator(".umap-popup")
    expect(popup).to_be_hidden()
    # Now click on the middle of the polygon, it should not show the popup
    map.click(position={"x": 150, "y": 150})
    expect(popup).to_be_hidden()
    # Click elsewhere on the map, it should now show the popup
    map.click(position={"x": 250, "y": 250})
    expect(popup).to_be_visible()
