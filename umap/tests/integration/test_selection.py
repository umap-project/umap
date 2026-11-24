import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db

DATALAYER_DATA = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "first marker"},
            "geometry": {"type": "Point", "coordinates": [14.6889, 48.5529]},
        },
        {
            "type": "Feature",
            "properties": {"name": "a line"},
            "geometry": {
                "type": "LineString",
                "coordinates": [[14.6950, 48.5560], [14.6990, 48.5580]],
            },
        },
    ],
}


@pytest.fixture
def bootstrap(openmap, live_server):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)


def test_enter_toggles_popup(live_server, openmap, page, bootstrap, wait_for_loaded):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}#16/48.5529/14.6889")
    wait_for_loaded(page)
    popup = page.locator(".umap-popup")
    page.locator("#map").click(position={"x": 640, "y": 340})
    expect(popup).to_contain_text("first marker")
    page.keyboard.press("Enter")
    expect(popup).to_be_hidden()
    page.keyboard.press("Enter")
    expect(popup).to_contain_text("first marker")


def test_tab_moves_to_next_feature(
    live_server, openmap, page, bootstrap, wait_for_loaded
):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}#16/48.5529/14.6889")
    wait_for_loaded(page)
    popup = page.locator(".umap-popup")
    page.locator("#map").click(position={"x": 640, "y": 340})
    expect(popup).to_contain_text("first marker")
    page.keyboard.press("Tab")
    expect(popup).to_contain_text("a line")
    page.keyboard.press("Shift+Tab")
    expect(popup).to_contain_text("first marker")


def test_tab_keeps_edit_mode(live_server, openmap, page, bootstrap, wait_for_edit_mode):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#16/48.5529/14.6889")
    wait_for_edit_mode(page)
    page.locator("#map").click(position={"x": 640, "y": 340})
    page.keyboard.press("Alt+Enter")
    name = page.locator('.panel.right input[name="name"]')
    expect(name).to_have_value("first marker")
    page.locator("#map").focus()
    page.keyboard.press("Tab")
    expect(name).to_have_value("a line")


def test_alt_click_toggles_edit(
    live_server, openmap, page, bootstrap, wait_for_edit_mode
):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#16/48.5529/14.6889")
    wait_for_edit_mode(page)
    panel = page.locator(".panel.right.on")
    page.locator("#map").click(position={"x": 640, "y": 340}, modifiers=["Alt"])
    expect(panel).to_be_visible()
    expect(page.locator(".umap-popup")).to_be_hidden()
    page.locator("#map").click(position={"x": 640, "y": 340}, modifiers=["Alt"])
    expect(panel).to_have_count(0)


def test_shift_alt_click_edits_layer(
    live_server, openmap, page, bootstrap, wait_for_edit_mode
):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#16/48.5529/14.6889")
    wait_for_edit_mode(page)
    page.locator("#map").click(
        position={"x": 640, "y": 340}, modifiers=["Shift", "Alt"]
    )
    expect(page.get_by_text("Layer properties")).to_be_visible()


def test_escape_ends_edit_then_selection(
    live_server, openmap, page, bootstrap, wait_for_edit_mode
):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#16/48.5529/14.6889")
    wait_for_edit_mode(page)
    popup = page.locator(".umap-popup")
    page.locator("#map").click(position={"x": 640, "y": 340})
    page.keyboard.press("Alt+Enter")
    expect(page.locator(".panel.right.on")).to_be_visible()
    expect(popup).to_be_visible()
    page.keyboard.press("Escape")
    expect(page.locator(".panel.right.on")).to_have_count(0)
    expect(popup).to_be_visible()
    page.keyboard.press("Escape")
    expect(popup).to_be_hidden()


def test_delete_removes_selected_feature(
    live_server, openmap, page, bootstrap, wait_for_edit_mode
):
    page.goto(
        f"{live_server.url}{openmap.get_absolute_url()}"
        "?edit&onLoadPanel=databrowser#16/48.5529/14.6889"
    )
    wait_for_edit_mode(page)
    counter = page.locator(".umap-browser .datalayer-counter")
    expect(counter).to_have_text("(2)")
    page.locator("#map").click(position={"x": 640, "y": 340})
    page.keyboard.press("Delete")
    expect(counter).to_have_text("(1)")
