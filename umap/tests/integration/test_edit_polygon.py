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


def test_can_edit_on_shift_click(live_server, openmap, page, datalayer):
    modifier = "Meta" if platform.system() == "Darwin" else "Control"
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.locator(".leaflet-marker-icon").click(modifiers=[modifier, "Shift"])
    expect(page.get_by_text("Layer properties")).to_be_visible()


def test_marker_style_should_have_precedence(live_server, openmap, page, bootstrap):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")

    # Change colour at layer level
    page.get_by_role("link", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit", exact=True).click()
    page.get_by_text("Shape properties").click()
    page.locator(".umap-field-color .define").click()
    expect(page.locator(".leaflet-overlay-pane path[fill='DarkBlue']")).to_have_count(1)
    page.get_by_title("DarkRed").first.click()
    expect(page.locator(".leaflet-overlay-pane path[fill='DarkRed']")).to_have_count(1)

    # Now change at polygon level, it should take precedence
    page.locator("path").click(modifiers=["Shift"])
    page.get_by_text("Shape properties").click()
    page.locator("#umap-feature-shape-properties").get_by_text("define").first.click()
    page.get_by_title("GoldenRod", exact=True).first.click()
    expect(page.locator(".leaflet-overlay-pane path[fill='GoldenRod']")).to_have_count(
        1
    )

    # Now change again at layer level again, it should not change the marker color
    page.get_by_role("link", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit", exact=True).click()
    page.get_by_text("Shape properties").click()
    page.locator(".umap-field-color input").click()
    page.get_by_title("DarkViolet").first.click()
    expect(page.locator(".leaflet-overlay-pane path[fill='GoldenRod']")).to_have_count(
        1
    )


def test_should_open_an_edit_toolbar_on_click(live_server, openmap, page, bootstrap):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.locator("path").click()
    expect(page.get_by_role("link", name="Toggle edit mode")).to_be_visible()
    expect(page.get_by_role("link", name="Delete this feature")).to_be_visible()


def test_can_remove_stroke(live_server, openmap, page, bootstrap):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    expect(page.locator(".leaflet-overlay-pane path[stroke='DarkBlue']")).to_have_count(
        1
    )
    page.locator("path").click()
    page.get_by_role("link", name="Toggle edit mode").click()
    page.get_by_text("Shape properties").click()
    page.locator(".umap-field-stroke .define").first.click()
    page.locator(".umap-field-stroke label").first.click()
    expect(page.locator(".leaflet-overlay-pane path[stroke='DarkBlue']")).to_have_count(
        0
    )
    expect(page.locator(".leaflet-overlay-pane path[stroke='none']")).to_have_count(1)


def test_should_reset_style_on_cancel(live_server, openmap, page, bootstrap):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.locator("path").click(modifiers=["Shift"])
    page.get_by_text("Shape properties").click()
    page.locator("#umap-feature-shape-properties").get_by_text("define").first.click()
    page.get_by_title("GoldenRod", exact=True).first.click()
    expect(page.locator(".leaflet-overlay-pane path[fill='GoldenRod']")).to_have_count(
        1
    )
    page.get_by_role("button", name="Cancel edits").click()
    page.locator("dialog").get_by_role("button", name="OK").click()
    expect(page.locator(".leaflet-overlay-pane path[fill='DarkBlue']")).to_have_count(1)


def test_can_change_datalayer(live_server, openmap, page, bootstrap):
    other = DataLayerFactory(
        name="Layer 2", map=openmap, settings={"color": "GoldenRod"}
    )
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    expect(page.locator("path[fill='DarkBlue']")).to_have_count(1)
    page.locator("path").click(modifiers=["Shift"])
    page.get_by_role("combobox").select_option(other.name)
    expect(page.locator("path[fill='GoldenRod']")).to_have_count(1)
