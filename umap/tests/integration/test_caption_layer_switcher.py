import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


def test_caption_layer_switcher_should_toggle_group_and_child(live_server, page, map):
    map.settings["properties"]["onLoadPanel"] = "caption"
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
        map=map, name="Parent Layer", data=parent_data, group=True
    )
    child = DataLayerFactory(
        map=map, name="Child Layer", data=child_data, parent=parent
    )
    child2 = DataLayerFactory(
        map=map, name="Child 2 Layer", data=child2_data, parent=parent
    )
    other = DataLayerFactory(map=map, name="Other Layer", data=other_data)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    select = page.locator(".umap-caption-bar select")
    expect(select).to_be_visible()
    expect(select).to_have_value("")
    expect(page.locator(".leaflet-marker-icon")).to_have_count(3)
    expect(page.get_by_text("Child marker"))
    expect(page.get_by_text("Child 2 marker"))
    expect(page.get_by_text("Other marker"))

    select.select_option(str(parent.pk))
    expect(page.locator(".leaflet-marker-icon")).to_have_count(2)
    expect(page.get_by_text("Child marker"))
    expect(page.get_by_text("Child 2 marker"))

    select.select_option("")
    expect(page.locator(".leaflet-marker-icon")).to_have_count(3)
    expect(page.get_by_text("Child marker"))
    expect(page.get_by_text("Child 2 marker"))
    expect(page.get_by_text("Other marker"))

    select.select_option(str(child.pk))
    expect(page.locator(".leaflet-marker-icon")).to_have_count(1)
    expect(page.get_by_text("Child marker"))

    select.select_option(str(child2.pk))
    expect(page.locator(".leaflet-marker-icon")).to_have_count(1)
    expect(page.get_by_text("Child 2 marker"))

    select.select_option(str(other.pk))
    expect(page.locator(".leaflet-marker-icon")).to_have_count(1)
    expect(page.get_by_text("Other marker"))
