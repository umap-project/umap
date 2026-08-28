import platform
from pathlib import Path

import pytest
from django.core.files.base import ContentFile
from playwright.sync_api import expect

from umap.models import Pictogram

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


DATALAYER_DATA = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [13.68896484375, 48.55297816440071],
            },
            "properties": {"_umap_options": {"color": "DarkCyan"}, "name": "Here"},
        }
    ],
    "properties": {"displayOnLoad": True, "name": "FooBarFoo"},
}
FIXTURES = Path(__file__).parent.parent / "fixtures"

# Icons are drawn on the canvas; each URL carries a `#16/48.55297/13.68896` hash to
# center the marker, so this small central clip captures the pin (anchored at center).
ICON_CLIP = {"x": 590, "y": 280, "width": 100, "height": 110}


@pytest.fixture
def pictos():
    path = FIXTURES / "star.svg"
    Pictogram(
        name="star", pictogram=ContentFile(path.read_text(), path.name), category="cat1"
    ).save()
    path = FIXTURES / "circle.svg"
    Pictogram(
        name="circle",
        pictogram=ContentFile(path.read_text(), path.name),
        category="cat2",
    ).save()


def test_can_change_picto_at_map_level(
    openmap, live_server, page, pictos, assert_screenshot
):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    page.goto(
        f"{live_server.url}{openmap.get_absolute_url()}?edit#16/48.55297/13.68896"
    )
    # Default icon, drawn on the canvas.
    assert_screenshot(page, suffix="default", clip=ICON_CLIP)
    edit_settings = page.get_by_title("Map advanced properties")
    expect(edit_settings).to_be_visible()
    edit_settings.click()
    shape_settings = page.get_by_text("Default shape properties")
    expect(shape_settings).to_be_visible()
    shape_settings.click()
    define = page.locator(".umap-field-iconUrl .define")
    undefine = page.locator(".umap-field-iconUrl .undefine")
    expect(define).to_be_visible()
    expect(undefine).to_be_hidden()
    define.click()
    # No picto defined yet, so recent should not be visible
    expect(page.get_by_text("Recent")).to_be_hidden()
    expect(page.get_by_text("cat1")).to_be_visible()
    expect(page.get_by_text("cat2")).to_be_visible()
    symbols = page.locator(".umap-pictogram-body .umap-pictogram-choice")
    expect(symbols).to_have_count(2)
    search = page.locator(".umap-pictogram-body input")
    search.type("star")
    expect(symbols).to_have_count(1)
    symbols.click()
    assert_screenshot(page, suffix="star", clip=ICON_CLIP)
    undefine.click()
    assert_screenshot(page, suffix="default", clip=ICON_CLIP)


def test_can_change_picto_at_datalayer_level(
    openmap, live_server, page, pictos, assert_screenshot
):
    openmap.settings["properties"]["iconUrl"] = "/uploads/pictogram/star.svg"
    openmap.save()
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    page.goto(
        f"{live_server.url}{openmap.get_absolute_url()}?edit#16/48.55297/13.68896"
    )
    # Icon inherited from the map, drawn on the canvas.
    assert_screenshot(page, suffix="star", clip=ICON_CLIP)
    # Edit datalayer: shift+meta click on the (centered) marker.
    modifier = "Meta" if platform.system() == "Darwin" else "Control"
    page.locator("#map").click(
        position={"x": 640, "y": 340}, modifiers=[modifier, "Shift"]
    )
    settings = page.get_by_text("Layer properties")
    expect(settings).to_be_visible()
    shape_settings = page.get_by_text("Shape properties")
    expect(shape_settings).to_be_visible()
    shape_settings.click()
    define = page.locator(".umap-field-iconUrl .define")
    undefine = page.locator(".umap-field-iconUrl .undefine")
    expect(define).to_be_visible()
    expect(undefine).to_be_hidden()
    define.click()
    # Map has an icon defined, so it should open on Recent tab
    symbols = page.locator(".umap-pictogram-body .umap-pictogram-choice")
    expect(page.get_by_text("Recent")).to_be_visible()
    expect(symbols).to_have_count(1)
    symbol_tab = page.get_by_role("button", name="Symbol")
    expect(symbol_tab).to_be_visible()
    symbol_tab.click()
    expect(symbols).to_have_count(2)
    search = page.locator(".umap-pictogram-body input")
    search.type("circle")
    expect(symbols).to_have_count(1)
    symbols.click()
    assert_screenshot(page, suffix="circle", clip=ICON_CLIP)
    undefine.click()
    # The marker is still selected (edit form open), so it keeps the highlight.
    assert_screenshot(page, suffix="star-highlighted", clip=ICON_CLIP)


def test_can_change_picto_at_marker_level(
    openmap, live_server, page, pictos, assert_screenshot
):
    openmap.settings["properties"]["iconUrl"] = "/uploads/pictogram/star.svg"
    openmap.save()
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    page.goto(
        f"{live_server.url}{openmap.get_absolute_url()}?edit#16/48.55297/13.68896"
    )
    # Icon inherited from the map, drawn on the canvas.
    assert_screenshot(page, suffix="star", clip=ICON_CLIP)
    # Edit marker: shift click on the (centered) marker.
    page.locator("#map").click(position={"x": 640, "y": 340}, modifiers=["Shift"])
    settings = page.get_by_text("Feature properties")
    expect(settings).to_be_visible()
    shape_settings = page.get_by_text("Shape properties")
    expect(shape_settings).to_be_visible()
    shape_settings.click()
    define = page.locator(".umap-field-iconUrl .define")
    undefine = page.locator(".umap-field-iconUrl .undefine")
    expect(define).to_be_visible()
    expect(undefine).to_be_hidden()
    define.click()
    # Map has an icon defined, so it should open on Recent tab
    symbols = page.locator(".umap-pictogram-body .umap-pictogram-choice")
    expect(page.get_by_text("Recent")).to_be_visible()
    expect(symbols).to_have_count(1)
    symbol_tab = page.get_by_role("button", name="Symbol")
    expect(symbol_tab).to_be_visible()
    symbol_tab.click()
    expect(symbols).to_have_count(2)
    search = page.locator(".umap-pictogram-body input")
    search.type("circle")
    expect(symbols).to_have_count(1)
    symbols.click()
    assert_screenshot(page, suffix="circle", clip=ICON_CLIP)
    undefine.click()
    # The marker is still selected (edit form open), so it keeps the highlight.
    assert_screenshot(page, suffix="star-highlighted", clip=ICON_CLIP)


def test_can_use_remote_url_as_picto(
    openmap, live_server, page, pictos, assert_screenshot
):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    page.route(
        "https://foo.bar/img.jpg",
        lambda route: route.fulfill(
            content_type="image/svg+xml",
            headers={"Access-Control-Allow-Origin": "*"},
            body='<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24">'
            '<rect width="24" height="24" fill="red"/></svg>',
        ),
    )
    page.goto(
        f"{live_server.url}{openmap.get_absolute_url()}?edit#16/48.55297/13.68896"
    )
    edit_settings = page.get_by_title("Map advanced properties")
    expect(edit_settings).to_be_visible()
    edit_settings.click()
    shape_settings = page.get_by_text("Default shape properties")
    expect(shape_settings).to_be_visible()
    shape_settings.click()
    define = page.locator(".umap-field-iconUrl .define")
    expect(define).to_be_visible()
    define.click()
    url_tab = page.get_by_role("button", name="URL")
    input_el = page.get_by_placeholder("Add image URL")
    expect(input_el).to_be_hidden()
    expect(url_tab).to_be_visible()
    url_tab.click()
    expect(input_el).to_be_visible()
    input_el.fill("https://foo.bar/img.jpg")
    input_el.blur()
    assert_screenshot(page, suffix="remote", clip=ICON_CLIP)
    # Now close and reopen the form, it should still be the URL tab
    close = page.locator(".panel.right.on .buttons").get_by_title("Close")
    expect(close).to_be_visible()
    close.click()
    edit_settings.click()
    shape_settings.click()
    modify = page.locator(".umap-field-iconUrl").get_by_text("Change")
    expect(modify).to_be_visible()
    modify.click()
    # Should be on Recent tab
    symbols = page.locator(".umap-pictogram-body .umap-pictogram-choice")
    expect(page.get_by_text("Recent")).to_be_visible()
    expect(symbols).to_have_count(1)


def test_can_use_char_as_picto(openmap, live_server, page, pictos, assert_screenshot):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    page.goto(
        f"{live_server.url}{openmap.get_absolute_url()}?edit#16/48.55297/13.68896"
    )
    edit_settings = page.get_by_title("Map advanced properties")
    expect(edit_settings).to_be_visible()
    edit_settings.click()
    shape_settings = page.get_by_text("Default shape properties")
    expect(shape_settings).to_be_visible()
    shape_settings.click()
    define = page.locator(".umap-field-iconUrl .define")
    define.click()
    url_tab = page.get_by_role("button", name="Emoji & Character")
    input_el = page.get_by_placeholder("Type char or paste emoji")
    expect(input_el).to_be_hidden()
    expect(url_tab).to_be_visible()
    url_tab.click()
    expect(input_el).to_be_visible()
    input_el.fill("♩")
    input_el.blur()
    assert_screenshot(page, suffix="char", clip=ICON_CLIP)
    # Now close and reopen the form, it should still be the URL tab
    close = page.locator(".panel.right.on .buttons").get_by_title("Close")
    expect(close).to_be_visible()
    close.click()
    edit_settings.click()
    shape_settings.click()
    preview = page.locator(".header .umap-pictogram-choice")
    expect(preview).to_be_visible()
    preview.click()
    # Should be on URL tab
    symbols = page.locator(".umap-pictogram-body .umap-pictogram-choice")
    expect(page.get_by_text("Recent")).to_be_visible()
    expect(symbols).to_have_count(1)
