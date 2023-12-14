from pathlib import Path

import pytest
from django.core.files.base import ContentFile
from playwright.sync_api import expect

from umap.models import Map, Pictogram

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
    "_umap_options": {"displayOnLoad": True, "name": "FooBarFoo"},
}
FIXTURES = Path(__file__).parent.parent / "fixtures"


@pytest.fixture
def pictos():
    path = FIXTURES / "star.svg"
    Pictogram(name="star", pictogram=ContentFile(path.read_text(), path.name)).save()
    path = FIXTURES / "circle.svg"
    Pictogram(name="circle", pictogram=ContentFile(path.read_text(), path.name)).save()


def test_can_change_picto_at_map_level(map, live_server, page, pictos):
    # Faster than doing a login
    map.edit_status = Map.ANONYMOUS
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    marker = page.locator(".umap-div-icon img")
    expect(marker).to_have_count(1)
    # Should have default img
    expect(marker).to_have_attribute("src", "/static/umap/img/marker.png")
    edit_settings = page.get_by_title("Edit map properties")
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
    symbols = page.locator(".umap-pictogram-choice")
    expect(symbols).to_have_count(2)
    search = page.locator(".umap-pictogram-body input")
    search.type("star")
    expect(symbols).to_have_count(1)
    symbols.click()
    expect(marker).to_have_attribute("src", "/uploads/pictogram/star.svg")
    undefine.click()
    expect(marker).to_have_attribute("src", "/static/umap/img/marker.png")


def test_can_change_picto_at_datalayer_level(map, live_server, page, pictos):
    # Faster than doing a login
    map.edit_status = Map.ANONYMOUS
    map.settings["properties"]["iconUrl"] = "/uploads/pictogram/star.svg"
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    marker = page.locator(".umap-div-icon img")
    expect(marker).to_have_count(1)
    # Should have default img
    expect(marker).to_have_attribute("src", "/uploads/pictogram/star.svg")
    # Edit datalayer
    marker.click(modifiers=["Control", "Shift"])
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
    symbols = page.locator(".umap-pictogram-choice")
    expect(symbols).to_have_count(2)
    search = page.locator(".umap-pictogram-body input")
    search.type("circle")
    expect(symbols).to_have_count(1)
    symbols.click()
    expect(marker).to_have_attribute("src", "/uploads/pictogram/circle.svg")
    undefine.click()
    expect(marker).to_have_attribute("src", "/uploads/pictogram/star.svg")


def test_can_change_picto_at_marker_level(map, live_server, page, pictos):
    # Faster than doing a login
    map.edit_status = Map.ANONYMOUS
    map.settings["properties"]["iconUrl"] = "/uploads/pictogram/star.svg"
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    marker = page.locator(".umap-div-icon img")
    expect(marker).to_have_count(1)
    # Should have default img
    expect(marker).to_have_attribute("src", "/uploads/pictogram/star.svg")
    # Edit marker
    marker.click(modifiers=["Shift"])
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
    symbols = page.locator(".umap-pictogram-choice")
    expect(symbols).to_have_count(2)
    search = page.locator(".umap-pictogram-body input")
    search.type("circle")
    expect(symbols).to_have_count(1)
    symbols.click()
    expect(marker).to_have_attribute("src", "/uploads/pictogram/circle.svg")
    undefine.click()
    expect(marker).to_have_attribute("src", "/uploads/pictogram/star.svg")


def test_can_use_remote_url_as_picto(map, live_server, page, pictos):
    # Faster than doing a login
    map.edit_status = Map.ANONYMOUS
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    marker = page.locator(".umap-div-icon img")
    expect(marker).to_have_count(1)
    # Should have default img
    expect(marker).to_have_attribute("src", "/static/umap/img/marker.png")
    edit_settings = page.get_by_title("Edit map properties")
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
    expect(marker).to_have_attribute("src", "https://foo.bar/img.jpg")
    # Now close and reopen the form, it should still be the URL tab
    close = page.locator("#umap-ui-container .toolbox").get_by_title("Close")
    expect(close).to_be_visible()
    close.click()
    edit_settings.click()
    shape_settings.click()
    modify = page.locator(".umap-field-iconUrl").get_by_text("Change")
    expect(modify).to_be_visible()
    modify.click()
    # Should be on URL tab
    expect(input_el).to_be_visible()


def test_can_use_char_as_picto(map, live_server, page, pictos):
    # Faster than doing a login
    map.edit_status = Map.ANONYMOUS
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    marker = page.locator(".umap-div-icon span")
    # Should have default img, so not a span
    expect(marker).to_have_count(0)
    edit_settings = page.get_by_title("Edit map properties")
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
    expect(marker).to_have_count(1)
    expect(marker).to_have_text("♩")
    # Now close and reopen the form, it should still be the URL tab
    close = page.locator("#umap-ui-container .toolbox").get_by_title("Close")
    expect(close).to_be_visible()
    close.click()
    edit_settings.click()
    shape_settings.click()
    preview = page.locator(".umap-pictogram-choice")
    expect(preview).to_be_visible()
    preview.click()
    # Should be on URL tab
    expect(input_el).to_be_visible()
