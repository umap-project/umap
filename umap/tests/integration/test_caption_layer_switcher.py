import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


def test_caption_layer_switcher_should_toggle_group_and_child(
    live_server, page, map, assert_screenshot
):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.settings["properties"]["captionBar"] = True
    map.settings["properties"]["layerSwitcher"] = True
    map.settings["properties"]["showLabel"] = True
    map.save()
    parent_data = {
        "type": "FeatureCollection",
        "features": [],
        "properties": {"name": "Parent Layer"},
    }
    child_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [13.4, 48.95]},
                "properties": {"name": "Child marker"},
            }
        ],
        "properties": {"name": "Child Layer"},
    }
    child2_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [13.6, 48.9]},
                "properties": {"name": "Child 2 marker"},
            }
        ],
        "properties": {"name": "Child 2 Layer"},
    }
    other_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [13.3, 48.85]},
                "properties": {"name": "Other marker"},
            }
        ],
        "properties": {"name": "Other Layer"},
    }
    parent = DataLayerFactory(
        map=map, name="Parent Layer", data=parent_data, group=True, rank=0
    )
    child = DataLayerFactory(
        map=map, name="Child Layer", data=child_data, parent=parent, rank=1
    )
    child2 = DataLayerFactory(
        map=map, name="Child 2 Layer", data=child2_data, parent=parent, rank=2
    )
    other = DataLayerFactory(map=map, name="Other Layer", data=other_data, rank=3)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    select = page.locator(".umap-caption-bar select")
    expect(select).to_be_visible()
    expect(select).to_have_value("")
    map_canvas = page.locator("#map")
    browser = page.locator(".panel.left")
    child_marker = browser.get_by_text("Child marker")
    child2_marker = browser.get_by_text("Child 2 marker")
    other_marker = browser.get_by_text("Other marker")

    expect(child_marker).to_be_visible()
    expect(child2_marker).to_be_visible()
    expect(other_marker).to_be_visible()
    assert_screenshot(map_canvas, suffix="all")

    select.select_option(str(parent.pk))
    expect(child_marker).to_be_visible()
    expect(child2_marker).to_be_visible()
    expect(other_marker).to_be_hidden()
    assert_screenshot(map_canvas, suffix="group")

    select.select_option("")
    expect(other_marker).to_be_visible()
    assert_screenshot(map_canvas, suffix="all")

    select.select_option(str(child.pk))
    expect(child_marker).to_be_visible()
    expect(child2_marker).to_be_hidden()
    expect(other_marker).to_be_hidden()
    assert_screenshot(map_canvas, suffix="child")

    select.select_option(str(child2.pk))
    expect(child2_marker).to_be_visible()
    expect(child_marker).to_be_hidden()
    expect(other_marker).to_be_hidden()
    assert_screenshot(map_canvas, suffix="child2")

    select.select_option(str(other.pk))
    expect(other_marker).to_be_visible()
    expect(child_marker).to_be_hidden()
    expect(child2_marker).to_be_hidden()
    assert_screenshot(map_canvas, suffix="other")
