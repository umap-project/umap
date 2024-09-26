import json
import os
import re

import pytest
from django.core.files.base import ContentFile
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


def set_options(datalayer, **options):
    # For now we need to change both the DB and the FS…
    datalayer.settings.update(options)
    data = json.load(datalayer.geojson.file)
    data["_umap_options"].update(**options)
    datalayer.geojson = ContentFile(json.dumps(data), "foo.json")
    datalayer.save()


def test_honour_displayOnLoad_false(map, live_server, datalayer, page):
    set_options(datalayer, displayOnLoad=False)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?onLoadPanel=datalayers")
    expect(page.locator(".leaflet-marker-icon")).to_be_hidden()
    layers = page.locator(".umap-browser .datalayer")
    markers = page.locator(".leaflet-marker-icon")
    layers_off = page.locator(".umap-browser .datalayer.off")
    expect(layers).to_have_count(1)
    expect(layers_off).to_have_count(1)
    page.get_by_role("button", name="Open browser").click()
    page.get_by_label("Zoom in").click()
    expect(markers).to_be_hidden()
    page.get_by_title("Show/hide layer").click()
    expect(layers_off).to_have_count(0)
    expect(markers).to_be_visible()


def test_should_honour_fromZoom(live_server, map, datalayer, page):
    set_options(datalayer, displayOnLoad=True, fromZoom=6)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#5/48.55/14.68")
    markers = page.locator(".leaflet-marker-icon")
    expect(markers).to_be_hidden()
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/48.55/14.68")
    expect(page).to_have_url(re.compile(r".*#6/48\..+/14\..+"))
    expect(markers).to_be_visible()
    page.get_by_label("Zoom out").click()
    expect(markers).to_be_hidden()
    page.get_by_label("Zoom in").click()
    expect(page).to_have_url(re.compile(r".*#6/48\..+/14\..+"))
    expect(markers).to_be_visible()
    page.get_by_label("Zoom in").click()
    expect(page).to_have_url(re.compile(r".*#7/48\..+/14\..+"))
    expect(markers).to_be_visible()


@pytest.mark.skipif(
    os.environ.get("CI", "false") == "true",
    reason="Test is failing intermittently, skipping in the CI",
)
def test_should_honour_toZoom(live_server, map, datalayer, page):
    set_options(datalayer, displayOnLoad=True, toZoom=6)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#7/48.55/14.68")
    markers = page.locator(".leaflet-marker-icon")
    expect(markers).to_be_hidden()
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/48.55/14.68")
    expect(page).to_have_url(re.compile(r".*#6/48\..+/14\..+"))
    expect(markers).to_be_visible()
    page.get_by_label("Zoom out").click()
    expect(page).to_have_url(re.compile(r".*#5/48\..+/14\..+"))
    expect(markers).to_be_visible()
    page.get_by_label("Zoom in").click()
    expect(page).to_have_url(re.compile(r".*#6/48\..+/14\..+"))
    expect(markers).to_be_visible()
    page.get_by_label("Zoom in").click()
    expect(page).to_have_url(re.compile(r".*#7/48\..+/14\..+"))
    expect(markers).to_be_hidden()


def test_should_honour_color_variable(live_server, map, page):
    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"mycolor": "aliceblue", "name": "Point 4"},
                "geometry": {"type": "Point", "coordinates": [0.856934, 45.290347]},
            },
            {
                "type": "Feature",
                "properties": {"name": "a polygon", "mycolor": "tomato"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [2.12, 49.57],
                            [1.08, 49.02],
                            [2.51, 47.55],
                            [3.19, 48.77],
                            [2.12, 49.57],
                        ]
                    ],
                },
            },
        ],
        "_umap_options": {
            "name": "Calque 2",
            "color": "{mycolor}",
            "fillColor": "{mycolor}",
        },
    }
    DataLayerFactory(map=map, data=data)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.locator(".leaflet-overlay-pane path[fill='tomato']"))
    markers = page.locator(".leaflet-marker-icon .icon_container")
    expect(markers).to_have_css("background-color", "rgb(240, 248, 255)")


def test_datalayers_in_query_string(live_server, datalayer, map, page):
    map.settings["properties"]["onLoadPanel"] = "datalayers"
    map.save()
    with_old_id = DataLayerFactory(old_id=134, map=map, name="with old id")
    set_options(with_old_id, name="with old id")
    visible = page.locator(".umap-browser .datalayer:not(.off) .datalayer-name")
    hidden = page.locator(".umap-browser .datalayer.off .datalayer-name")
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(visible).to_have_count(2)
    expect(hidden).to_have_count(0)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?datalayers={datalayer.pk}")
    expect(visible).to_have_count(1)
    expect(visible).to_have_text(datalayer.name)
    expect(hidden).to_have_count(1)
    expect(hidden).to_have_text(with_old_id.name)
    page.goto(
        f"{live_server.url}{map.get_absolute_url()}?datalayers={with_old_id.old_id}"
    )
    expect(visible).to_have_count(1)
    expect(visible).to_have_text(with_old_id.name)
    expect(hidden).to_have_count(1)
    expect(hidden).to_have_text(datalayer.name)
