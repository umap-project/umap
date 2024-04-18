import copy

import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


DATALAYER_DATA1 = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "mytype": "even",
                "name": "Point 2",
                "mynumber": 10,
                # Same day/month value to work around Javascript/browser
                # crazyness date format
                "mydate": "2024/04/04 12:19:17",
            },
            "geometry": {"type": "Point", "coordinates": [0.065918, 48.385442]},
        },
        {
            "type": "Feature",
            "properties": {
                "mytype": "odd",
                "name": "Point 1",
                "mynumber": 12,
                "mydate": "2024/03/03 12:20:20",
            },
            "geometry": {"type": "Point", "coordinates": [3.55957, 49.767074]},
        },
    ],
    "_umap_options": {
        "name": "Calque 1",
    },
}


DATALAYER_DATA2 = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "mytype": "even",
                "name": "Point 4",
                "mynumber": 10,
                "mydate": "2024/08/08 13:14:15",
            },
            "geometry": {"type": "Point", "coordinates": [0.856934, 45.290347]},
        },
        {
            "type": "Feature",
            "properties": {
                "mytype": "odd",
                "name": "Point 3",
                "mynumber": 14,
                "mydate": "2024-04-04T10:19:17.000Z",
            },
            "geometry": {"type": "Point", "coordinates": [4.372559, 47.945786]},
        },
    ],
    "_umap_options": {
        "name": "Calque 2",
    },
}


DATALAYER_DATA3 = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "a polygon"},
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
    "_umap_options": {"name": "Calque 2", "browsable": False},
}


def test_simple_facet_search(live_server, page, map):
    map.settings["properties"]["onLoadPanel"] = "facet"
    map.settings["properties"]["facetKey"] = "mytype|My type,mynumber|My Number|number"
    map.settings["properties"]["showLabel"] = True
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA1)
    DataLayerFactory(map=map, data=DATALAYER_DATA2)
    DataLayerFactory(map=map, data=DATALAYER_DATA3)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/48.948/1.670")
    panel = page.locator(".umap-facet-search")
    # From a non browsable datalayer, should not be impacted
    paths = page.locator(".leaflet-overlay-pane path")
    expect(paths).to_be_visible()
    expect(panel).to_be_visible()
    # Facet name
    expect(page.get_by_text("My type")).to_be_visible()
    # Facet values
    oven = page.get_by_text("even")
    odd = page.get_by_text("odd")
    expect(oven).to_be_visible()
    expect(odd).to_be_visible()
    expect(paths).to_be_visible()
    markers = page.locator(".leaflet-marker-icon")
    expect(markers).to_have_count(4)
    # Tooltips
    expect(page.get_by_text("Point 1")).to_be_visible()
    expect(page.get_by_text("Point 2")).to_be_visible()
    expect(page.get_by_text("Point 3")).to_be_visible()
    expect(page.get_by_text("Point 4")).to_be_visible()
    # Now let's filter
    odd.click()
    expect(markers).to_have_count(2)
    expect(page.get_by_text("Point 2")).to_be_hidden()
    expect(page.get_by_text("Point 4")).to_be_hidden()
    expect(page.get_by_text("Point 1")).to_be_visible()
    expect(page.get_by_text("Point 3")).to_be_visible()
    expect(paths).to_be_visible
    # Now let's filter
    odd.click()
    expect(markers).to_have_count(4)
    expect(paths).to_be_visible()

    # Let's filter using the number facet
    expect(page.get_by_text("My Number")).to_be_visible()
    expect(page.get_by_label("Min")).to_have_value("10")
    expect(page.get_by_label("Max")).to_have_value("14")
    page.get_by_label("Min").fill("11")
    page.keyboard.press("Tab")  # Move out of the input, so the "change" event is sent
    expect(markers).to_have_count(2)
    expect(paths).to_be_visible()
    page.get_by_label("Max").fill("13")
    page.keyboard.press("Tab")
    expect(markers).to_have_count(1)

    # Now let's combine
    page.get_by_label("Min").fill("10")
    page.keyboard.press("Tab")
    expect(markers).to_have_count(3)
    odd.click()
    expect(markers).to_have_count(1)
    expect(paths).to_be_visible()


def test_date_facet_search(live_server, page, map):
    map.settings["properties"]["onLoadPanel"] = "facet"
    map.settings["properties"]["facetKey"] = "mydate|Date filter|date"
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA1)
    DataLayerFactory(map=map, data=DATALAYER_DATA2)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    markers = page.locator(".leaflet-marker-icon")
    expect(markers).to_have_count(4)
    expect(page.get_by_text("Date Filter")).to_be_visible()
    expect(page.get_by_label("From")).to_have_value("2024-03-03")
    expect(page.get_by_label("Until")).to_have_value("2024-08-08")
    # Change     the month (crazy US date format in Chromium ran by Playwright in my OS)
    page.get_by_label("From").press("ArrowUp")
    expect(markers).to_have_count(3)
    page.get_by_label("Until").press("ArrowDown")
    expect(markers).to_have_count(2)


def test_choice_with_empty_value(live_server, page, map):
    map.settings["properties"]["onLoadPanel"] = "facet"
    map.settings["properties"]["facetKey"] = "mytype|My type"
    map.save()
    data = copy.deepcopy(DATALAYER_DATA1)
    data["features"][0]["properties"]["mytype"] = ""
    del data["features"][1]["properties"]["mytype"]
    DataLayerFactory(map=map, data=data)
    DataLayerFactory(map=map, data=DATALAYER_DATA2)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.get_by_text("<empty value>")).to_be_visible()
    markers = page.locator(".leaflet-marker-icon")
    expect(markers).to_have_count(4)
    page.get_by_text("<empty value>").click()
    expect(markers).to_have_count(2)


def test_number_with_zero_value(live_server, page, map):
    map.settings["properties"]["onLoadPanel"] = "facet"
    map.settings["properties"]["facetKey"] = "mynumber|Filter|number"
    map.save()
    data = copy.deepcopy(DATALAYER_DATA1)
    data["features"][0]["properties"]["mynumber"] = 0
    DataLayerFactory(map=map, data=data)
    DataLayerFactory(map=map, data=DATALAYER_DATA2)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.get_by_label("Min")).to_have_value("0")
    expect(page.get_by_label("Max")).to_have_value("14")
    page.get_by_label("Min").fill("1")
    page.keyboard.press("Tab")  # Move out of the input, so the "change" event is sent
    markers = page.locator(".leaflet-marker-icon")
    expect(markers).to_have_count(3)
