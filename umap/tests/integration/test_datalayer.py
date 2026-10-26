import re

import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


def test_honour_displayOnLoad_false(map, live_server, datalayer, page):
    datalayer.settings.update(displayOnLoad=False)
    datalayer.save()
    page.goto(
        f"{live_server.url}{map.get_absolute_url()}"
        "?onLoadPanel=datalayers#6/48.55/14.68"
    )
    layers = page.locator(".umap-browser .datalayer")
    layers_off = page.locator(".umap-browser .datalayer summary.off")
    expect(layers).to_have_count(1)
    expect(layers_off).to_have_count(1)
    # Zooming must not bring back a layer that was not displayed at load.
    page.get_by_label("Zoom in").click()
    expect(page).to_have_url(re.compile(r".*#7/48\..+/14\..+"))
    expect(layers_off).to_have_count(1)
    with page.expect_response(re.compile(rf".*/datalayer/{map.pk}/{datalayer.pk}/.*")):
        page.get_by_title("Show/hide layer").click()
    expect(layers_off).to_have_count(0)


def test_should_honour_fromZoom(live_server, map, datalayer, new_page):
    datalayer.settings.update(displayOnLoad=True, fromZoom=6)
    datalayer.save()
    url = f"{live_server.url}{map.get_absolute_url()}?onLoadPanel=datalayers"
    page = new_page()
    page.goto(f"{url}#5/48.55/14.68")
    expect(page.locator(".umap-browser .datalayer summary.off")).to_have_count(1)
    page2 = new_page()
    page2.goto(f"{url}#6/48.55/14.68")
    expect(page2).to_have_url(re.compile(r".*#6/48\..+/14\..+"))
    hidden = page2.locator(".umap-browser .datalayer summary.off")
    expect(hidden).to_have_count(0)
    page2.get_by_label("Zoom out").click()
    expect(page2).to_have_url(re.compile(r".*#5/48\..+/14\..+"))
    expect(hidden).to_have_count(1)
    page2.get_by_label("Zoom in").click()
    expect(page2).to_have_url(re.compile(r".*#6/48\..+/14\..+"))
    expect(hidden).to_have_count(0)
    page2.get_by_label("Zoom in").click()
    expect(page2).to_have_url(re.compile(r".*#7/48\..+/14\..+"))
    expect(hidden).to_have_count(0)


def test_should_honour_toZoom(live_server, map, datalayer, page, new_page):
    datalayer.settings.update(displayOnLoad=True, toZoom=6)
    datalayer.save()
    url = f"{live_server.url}{map.get_absolute_url()}?onLoadPanel=datalayers"
    # Loading at zoom 7 should not show the layer
    page.goto(f"{url}#7/48.55/14.68")
    expect(page.locator(".umap-browser .datalayer summary.off")).to_have_count(1)

    # Loading at zoom 6 should show the layer
    page2 = new_page()
    hidden = page2.locator(".umap-browser .datalayer summary.off")
    page2.goto(f"{url}#6/48.55/14.68")
    expect(page2).to_have_url(re.compile(r".*#6/48\..+/14\..+"))
    expect(hidden).to_have_count(0)

    # Now try to unzoom/rezoom and check that the layer shows/hides accordingly.
    page2.get_by_label("Zoom out").click()
    expect(page2).to_have_url(re.compile(r".*#5/48\..+/14\..+"))
    expect(hidden).to_have_count(0)
    page2.get_by_label("Zoom in").click()
    expect(page2).to_have_url(re.compile(r".*#6/48\..+/14\..+"))
    expect(hidden).to_have_count(0)
    page2.get_by_label("Zoom in").click()
    expect(page2).to_have_url(re.compile(r".*#7/48\..+/14\..+"))
    expect(hidden).to_have_count(1)


def test_should_honour_color_variable(live_server, map, page, assert_screenshot):
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
        "properties": {
            "name": "Calque 2",
            "color": "{mycolor}",
            "fillColor": "{mycolor}",
        },
    }
    DataLayerFactory(map=map, data=data)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/47.5/2.5")
    assert_screenshot(page, ui=False)
    page.get_by_title("Open browser").click()
    expect(page.locator(".umap-browser .datalayer-counter")).to_have_text("(2)")
    page.locator(".umap-browser .datalayer").first.click()
    expect(page.locator(".umap-browser .feature.marker .feature-color")).to_have_css(
        "background-color", "rgb(240, 248, 255)"
    )
    expect(page.locator(".umap-browser .feature.polygon .feature-color")).to_have_css(
        "background-color", "rgb(255, 99, 71)"
    )


def test_datalayers_in_query_string(live_server, datalayer, map, page):
    map.settings["properties"]["onLoadPanel"] = "datalayers"
    map.save()
    with_old_id = DataLayerFactory(old_id=134, map=map, name="with old id")
    # The name is a span inside .datalayer-name, which also holds the counter.
    visible = page.locator(
        ".umap-browser .datalayer summary:not(.off) .datalayer-name [data-onrename]"
    )
    hidden = page.locator(
        ".umap-browser .datalayer summary.off .datalayer-name [data-onrename]"
    )
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
