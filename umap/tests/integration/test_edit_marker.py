import platform
from copy import deepcopy

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
                "name": "test marker",
                "description": "Some description",
            },
            "id": "QwNjg",
            "geometry": {
                "type": "Point",
                "coordinates": [14.6889, 48.5529],
            },
        },
    ],
}


@pytest.fixture
def bootstrap(map, live_server):
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
    expect(page.locator(".leaflet-marker-icon .icon_container")).to_have_css(
        "background-color", "rgb(0, 0, 139)"
    )
    page.get_by_title("DarkRed").first.click()
    expect(page.locator(".leaflet-marker-icon .icon_container")).to_have_css(
        "background-color", "rgb(139, 0, 0)"
    )

    # Now change at marker level, it should take precedence
    page.locator(".leaflet-marker-icon").click(modifiers=["Shift"])
    page.get_by_text("Shape properties").click()
    page.locator("#umap-feature-shape-properties").get_by_text("define").first.click()
    page.get_by_title("GoldenRod", exact=True).click()
    expect(page.locator(".leaflet-marker-icon .icon_container")).to_have_css(
        "background-color", "rgb(218, 165, 32)"
    )

    # Now change again at layer level again, it should not change the marker color
    page.get_by_role("link", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit", exact=True).click()
    page.get_by_text("Shape properties").click()
    page.locator(".umap-field-color input").click()
    page.get_by_title("DarkViolet").first.click()
    expect(page.locator(".leaflet-marker-icon .icon_container")).to_have_css(
        "background-color", "rgb(218, 165, 32)"
    )


def test_should_open_an_edit_toolbar_on_click(live_server, openmap, page, bootstrap):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.locator(".leaflet-marker-icon").click()
    expect(page.get_by_role("link", name="Toggle edit mode")).to_be_visible()
    expect(page.get_by_role("link", name="Delete this feature")).to_be_visible()


def test_should_update_open_popup_on_edit(live_server, openmap, page, bootstrap):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}")
    expect(page.locator(".umap-icon-active")).to_be_hidden()
    page.locator(".leaflet-marker-icon").click()
    expect(page.locator(".leaflet-popup-content-wrapper")).to_be_visible()
    expect(page.get_by_text("test marker")).to_be_visible()
    expect(page.get_by_text("Some description")).to_be_visible()
    page.get_by_role("button", name="Edit").click()
    page.locator(".leaflet-marker-icon").click(modifiers=["Shift"])
    page.locator('input[name="name"]').fill("test marker edited")
    expect(page.get_by_text("test marker edited")).to_be_visible()


def test_should_follow_datalayer_style_when_changing_datalayer(
    live_server, openmap, page
):
    data = deepcopy(DATALAYER_DATA)
    data["_umap_options"] = {"color": "DarkCyan"}
    DataLayerFactory(map=openmap, data=data)
    DataLayerFactory(
        map=openmap,
        name="other datalayer",
        data={
            "type": "FeatureCollection",
            "features": [],
            "_umap_options": {"color": "DarkViolet"},
        },
    )
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    marker = page.locator(".leaflet-marker-icon .icon_container")
    expect(marker).to_have_css("background-color", "rgb(0, 139, 139)")
    # Change datalayer
    marker.click()
    page.get_by_role("link", name="Toggle edit mode (⇧+Click)").click()
    page.locator(".umap-field-datalayer select").select_option(label="other datalayer")
    expect(marker).to_have_css("background-color", "rgb(148, 0, 211)")
