import platform

import pytest
from playwright.sync_api import expect

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
def bootstrap(map, live_server):
    map.settings["properties"]["zoom"] = 6
    map.settings["geometry"] = {
        "type": "Point",
        "coordinates": [8.429, 53.239],
    }
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA)


def test_can_edit_on_ctrl_shift_click(
    live_server, openmap, page, datalayer, wait_for_edit_mode
):
    modifier = "Meta" if platform.system() == "Darwin" else "Control"
    page.goto(
        f"{live_server.url}{openmap.get_absolute_url()}?edit#16/48.55298/14.68896"
    )
    wait_for_edit_mode(page)
    page.locator("#map").click(
        position={"x": 640, "y": 340}, modifiers=[modifier, "Shift"]
    )
    expect(page.get_by_text("Layer properties")).to_be_visible()


def test_marker_style_should_have_precedence(
    live_server, openmap, page, bootstrap, wait_for_edit_mode, assert_screenshot
):
    page.goto(
        f"{live_server.url}{openmap.get_absolute_url()}"
        "?edit&onLoadPanel=databrowser#6/53.109/12.162"
    )
    wait_for_edit_mode(page)
    page.locator(".umap-browser .datalayer").click()
    color = page.locator(".umap-browser .feature-color")
    expect(color).to_have_css("background-color", "rgb(0, 0, 139)")

    # Change colour at layer level
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel.right").get_by_title("Edit", exact=True).click()
    page.get_by_text("Shape properties").click()
    page.locator(".umap-field-color .define").click()
    page.get_by_title("DarkRed").first.click()
    assert_screenshot(page, suffix="layer-color", ui=False)

    # Now change at polygon level, it should take precedence
    page.locator("#map").click(position={"x": 640, "y": 360}, modifiers=["Shift"])
    page.get_by_text("Shape properties").click()
    page.locator("#umap-feature-shape-properties").get_by_text("define").first.click()
    page.locator("#umap-feature-shape-properties").get_by_title(
        "GoldenRod", exact=True
    ).first.click()
    expect(color).to_have_css("background-color", "rgb(218, 165, 32)")

    # Now change again at layer level again, it should not change the marker color
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel.right").get_by_title("Edit", exact=True).click()
    page.get_by_text("Shape properties").click()
    page.locator(".umap-field-color input").click()
    page.get_by_title("DarkViolet").first.click()
    assert_screenshot(page, suffix="polygon-color", ui=False)


def test_should_open_an_edit_toolbar_on_click(
    live_server, openmap, page, bootstrap, wait_for_edit_mode
):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#6/53.109/12.162")
    wait_for_edit_mode(page)
    page.locator("#map").click(position={"x": 640, "y": 360}, button="right")
    expect(page.get_by_role("button", name="Toggle edit mode")).to_be_visible()
    expect(page.get_by_role("button", name="Delete this feature")).to_be_visible()


def test_can_remove_stroke(
    live_server, openmap, page, bootstrap, wait_for_edit_mode, assert_screenshot
):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#6/53.109/12.162")
    wait_for_edit_mode(page)
    assert_screenshot(page, suffix="with-stroke", ui=False)
    page.locator("#map").click(position={"x": 640, "y": 360}, button="right")
    page.get_by_role("button", name="Toggle edit mode").click()
    page.get_by_text("Shape properties").click()
    page.locator(".umap-field-stroke .define").first.click()
    page.locator(".umap-field-stroke .show-on-defined label").first.click()
    # Leave edit mode, so the polygon is not rendered highlighted.
    page.locator(".panel.right .icon-close").click()
    expect(page.locator(".panel.right.on")).to_have_count(0)
    assert_screenshot(page, suffix="without-stroke", ui=False)


def test_should_reset_style_on_cancel(
    live_server, openmap, page, bootstrap, wait_for_edit_mode
):
    page.goto(
        f"{live_server.url}{openmap.get_absolute_url()}"
        "?edit&onLoadPanel=databrowser#6/53.109/12.162"
    )
    wait_for_edit_mode(page)
    page.locator(".umap-browser .datalayer").click()
    color = page.locator(".umap-browser .feature-color")
    page.locator("#map").click(position={"x": 640, "y": 360}, modifiers=["Shift"])
    page.get_by_text("Shape properties").click()
    page.locator("#umap-feature-shape-properties").get_by_text("define").first.click()
    page.locator("#umap-feature-shape-properties").get_by_title(
        "GoldenRod", exact=True
    ).first.click()
    expect(color).to_have_css("background-color", "rgb(218, 165, 32)")
    page.locator(".edit-undo").click()
    expect(color).to_have_css("background-color", "rgb(0, 0, 139)")


def test_can_change_datalayer(
    live_server, openmap, page, bootstrap, wait_for_edit_mode
):
    other = DataLayerFactory(
        name="Layer 2", map=openmap, settings={"color": "GoldenRod"}
    )
    page.goto(
        f"{live_server.url}{openmap.get_absolute_url()}"
        "?edit&onLoadPanel=databrowser#6/53.109/12.162"
    )
    wait_for_edit_mode(page)
    # The polygon moves from one layer to the other, so expand both.
    page.locator(".umap-browser .datalayer").first.click()
    page.locator(".umap-browser .datalayer").nth(1).click()
    color = page.locator(".umap-browser .feature.polygon .feature-color")
    expect(color).to_have_css("background-color", "rgb(0, 0, 139)")
    page.locator("#map").click(position={"x": 640, "y": 360}, modifiers=["Shift"])
    page.locator(".umap-field-datalayer select").select_option(other.name)
    expect(color).to_have_css("background-color", "rgb(218, 165, 32)")
