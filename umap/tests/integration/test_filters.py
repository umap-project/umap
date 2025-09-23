import copy
import re

import pytest
from playwright.sync_api import expect

from umap.models import DataLayer, Map

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
                "mydate": "2024/04/14 12:19:17",
            },
            "geometry": {"type": "Point", "coordinates": [0.065918, 48.385442]},
        },
        {
            "type": "Feature",
            "properties": {
                "mytype": "odd",
                "name": "Point 1",
                "mynumber": 12,
                "mydate": "2024/03/13 12:20:20",
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
                "mydate": "2024/08/18 13:14:15",
            },
            "geometry": {"type": "Point", "coordinates": [0.856934, 45.290347]},
        },
        {
            "type": "Feature",
            "properties": {
                "mytype": "odd",
                "name": "Point 3",
                "mynumber": 14,
                "mydate": "2024-04-14T10:19:17.000Z",
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
    map.settings["properties"]["onLoadPanel"] = "datafilters"
    map.settings["properties"]["filters"] = {
        "mytype": {"label": "My type"},
        "mynumber": {"label": "My number", "widget": "minmax"},
    }
    map.settings["properties"]["fields"] = [
        {"key": "mytype", "type": "String"},
        {"key": "mynumber", "type": "Number"},
    ]
    map.settings["properties"]["showLabel"] = True
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA1)
    DataLayerFactory(map=map, data=DATALAYER_DATA2)
    DataLayerFactory(map=map, data=DATALAYER_DATA3)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/48.948/1.670")
    panel = page.locator(".panel.left.on")
    expect(panel).to_have_class(re.compile(".*expanded.*"))
    expect(panel.locator(".umap-browser")).to_be_visible()
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
    # Sometimes PW founds two tooltips with the same name, but cannot reproduce it.
    page.wait_for_timeout(300)
    expect(page.get_by_role("tooltip", name="Point 1")).to_be_visible()
    expect(page.get_by_role("tooltip", name="Point 2")).to_be_visible()
    expect(page.get_by_role("tooltip", name="Point 3")).to_be_visible()
    expect(page.get_by_role("tooltip", name="Point 4")).to_be_visible()

    # Datalist
    expect(panel.get_by_text("Point 1")).to_be_visible()
    expect(panel.get_by_text("Point 2")).to_be_visible()
    expect(panel.get_by_text("Point 3")).to_be_visible()
    expect(panel.get_by_text("Point 4")).to_be_visible()

    # Now let's filter
    odd.click()
    expect(markers).to_have_count(2)
    expect(page.get_by_role("tooltip", name="Point 2")).to_be_hidden()
    expect(page.get_by_role("tooltip", name="Point 4")).to_be_hidden()
    expect(page.get_by_role("tooltip", name="Point 1")).to_be_visible()
    expect(page.get_by_role("tooltip", name="Point 3")).to_be_visible()
    expect(panel.get_by_text("Point 2")).to_be_hidden()
    expect(panel.get_by_text("Point 4")).to_be_hidden()
    expect(panel.get_by_text("Point 1")).to_be_visible()
    expect(panel.get_by_text("Point 3")).to_be_visible()
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
    map.settings["properties"]["onLoadPanel"] = "datafilters"
    map.settings["properties"]["filters"] = {
        "mydate": {"label": "Date filter", "widget": "minmax"}
    }
    map.settings["properties"]["fields"] = [{"key": "mydate", "type": "Date"}]
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA1)
    DataLayerFactory(map=map, data=DATALAYER_DATA2)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/47.5/-1.5")
    markers = page.locator(".leaflet-marker-icon")
    expect(markers).to_have_count(4)
    expect(page.get_by_text("Date Filter")).to_be_visible()
    expect(page.get_by_label("From")).to_have_value("2024-03-13")
    expect(page.get_by_label("Until")).to_have_value("2024-08-18")
    page.get_by_label("From").fill("2024-03-14")
    expect(markers).to_have_count(3)
    page.get_by_label("Until").fill("2024-08-17")
    expect(markers).to_have_count(2)


def test_choice_with_empty_value(live_server, page, map):
    map.settings["properties"]["onLoadPanel"] = "datafilters"
    map.settings["properties"]["fields"] = [{"key": "mytype", "type": "String"}]
    map.settings["properties"]["filters"] = {"mytype": {"label": "My type"}}
    map.save()
    data = copy.deepcopy(DATALAYER_DATA1)
    data["features"][0]["properties"]["mytype"] = ""
    del data["features"][1]["properties"]["mytype"]
    DataLayerFactory(map=map, data=data)
    DataLayerFactory(map=map, data=DATALAYER_DATA2)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/47.5/-1.5")
    expect(page.get_by_text("<empty value>")).to_be_visible()
    markers = page.locator(".leaflet-marker-icon")
    expect(markers).to_have_count(4)
    page.get_by_text("<empty value>").click()
    expect(markers).to_have_count(2)


def test_number_with_zero_value(live_server, page, map):
    map.settings["properties"]["onLoadPanel"] = "datafilters"
    map.settings["properties"]["filters"] = {
        "mynumber": {"label": "Filter", "widget": "minmax"}
    }
    map.settings["properties"]["fields"] = [{"key": "mynumber", "type": "Number"}]
    map.save()
    data = copy.deepcopy(DATALAYER_DATA1)
    data["features"][0]["properties"]["mynumber"] = 0
    DataLayerFactory(map=map, data=data)
    DataLayerFactory(map=map, data=DATALAYER_DATA2)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/47.5/-1.5")
    expect(page.get_by_label("Min")).to_have_value("0")
    expect(page.get_by_label("Max")).to_have_value("14")
    page.get_by_label("Min").fill("1")
    page.keyboard.press("Tab")  # Move out of the input, so the "change" event is sent
    markers = page.locator(".leaflet-marker-icon")
    expect(markers).to_have_count(3)


def test_facets_search_are_persistent_when_closing_panel(live_server, page, map):
    map.settings["properties"]["onLoadPanel"] = "datafilters"
    map.settings["properties"]["filters"] = {
        "mytype": {"label": "My type"},
        "mynumber": {"label": "My Number", "widget": "minmax"},
    }
    map.settings["properties"]["fields"] = [
        {"key": "mytype"},
        {"key": "mynumber", "type": "Number"},
    ]
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA1)
    DataLayerFactory(map=map, data=DATALAYER_DATA2)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/48.948/1.670")
    panel = page.locator(".panel.left")

    # Facet values
    odd = page.get_by_label("odd")
    markers = page.locator(".leaflet-marker-icon")
    expect(markers).to_have_count(4)

    # Datalist in the browser
    expect(panel.get_by_text("Point 1")).to_be_visible()
    expect(panel.get_by_text("Point 2")).to_be_visible()
    expect(panel.get_by_text("Point 3")).to_be_visible()
    expect(panel.get_by_text("Point 4")).to_be_visible()

    # Now let's filter
    odd.click()
    expect(page.locator(".filters summary")).to_have_attribute("data-badge", " ")
    expect(page.locator(".umap-control-browse")).to_have_attribute("data-badge", " ")
    expect(markers).to_have_count(2)
    expect(panel.get_by_text("Point 2")).to_be_hidden()
    expect(panel.get_by_text("Point 4")).to_be_hidden()
    expect(panel.get_by_text("Point 1")).to_be_visible()
    expect(panel.get_by_text("Point 3")).to_be_visible()

    # Let's filter using the number facet
    expect(panel.get_by_label("Min")).to_have_value("10")
    expect(panel.get_by_label("Max")).to_have_value("14")
    page.get_by_label("Min").fill("13")
    page.keyboard.press("Tab")  # Move out of the input, so the "change" event is sent
    expect(panel.get_by_label("Min")).to_have_attribute("data-modified", "true")
    expect(markers).to_have_count(1)
    expect(panel.get_by_text("Point 2")).to_be_hidden()
    expect(panel.get_by_text("Point 4")).to_be_hidden()
    expect(panel.get_by_text("Point 1")).to_be_hidden()
    expect(panel.get_by_text("Point 3")).to_be_visible()

    # Close panel
    expect(panel.locator(".filters summary")).to_have_attribute("data-badge", " ")
    expect(page.locator(".umap-control-browse")).to_have_attribute("data-badge", " ")
    panel.get_by_role("button", name="Close").click()
    page.get_by_role("button", name="Open browser").click()
    expect(panel.get_by_label("Min")).to_have_value("13")
    expect(panel.get_by_label("Min")).to_have_attribute("data-modified", "true")
    expect(panel.get_by_label("odd")).to_be_checked()

    # Datalist in the browser should be inchanged
    expect(panel.get_by_text("Point 2")).to_be_hidden()
    expect(panel.get_by_text("Point 4")).to_be_hidden()
    expect(panel.get_by_text("Point 1")).to_be_hidden()
    expect(panel.get_by_text("Point 3")).to_be_visible()


def test_can_load_legacy_facetKey(live_server, page, openmap):
    openmap.settings["properties"]["facetKey"] = (
        "mytype|My Type|radio,mynumber|My Number|number,mydate|My Date|date"
    )
    openmap.save()
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    expect(
        page.get_by_text("The map has been upgraded to latest version, please save it.")
    ).to_be_visible()
    with page.expect_response(re.compile("./update/settings/.*")):
        page.get_by_role("button", name="Save", exact=True).click()
    saved = Map.objects.first()
    assert "facetKey" not in saved.settings["properties"]
    assert saved.settings["properties"]["filters"] == {
        "mydate": {
            "label": "My Date",
            "widget": "minmax",
        },
        "mynumber": {
            "label": "My Number",
            "widget": "minmax",
        },
        "mytype": {
            "label": "My Type",
            "widget": "radio",
        },
    }
    assert saved.settings["properties"]["fields"] == [
        {"key": "mytype", "type": "String"},
        {"key": "mynumber", "type": "Number"},
        {"key": "mydate", "type": "Date"},
    ]


def test_deleting_field_should_delete_filter(live_server, page, openmap, datalayer):
    datalayer.settings["fields"] = [
        {"key": "name", "type": "String"},
        {"key": "foobar", "type": "Number"},
        {"key": "description", "type": "Text"},
    ]
    datalayer.settings["filters"] = {
        "foobar": {"widget": "minmax", "label": "Foo Bar"},
        "name": {"widget": "checkbox", "label": "Bar Foo"},
    }
    datalayer.save()
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Edit", exact=True).click()
    page.get_by_text("Fields, filters and keys").click()
    page.get_by_role("button", name="Delete this field").nth(1).click()
    page.get_by_role("button", name="OK").click()
    with page.expect_response(re.compile(r".*/datalayer/update/")):
        page.get_by_role("button", name="Save").click()
    saved = DataLayer.objects.first()
    assert saved.settings["fields"] == [
        {"key": "name", "type": "String"},
        {"key": "description", "type": "Text"},
    ]
    saved.settings["filters"] == {
        "name": {"widget": "checkbox", "label": "Bar Foo"},
    }
    page.locator(".edit-undo").click()
    with page.expect_response(re.compile(r".*/datalayer/update/")):
        page.get_by_role("button", name="Save").click()
    saved = DataLayer.objects.first()
    assert saved.settings["fields"] == [
        {"key": "name", "type": "String"},
        {"key": "foobar", "type": "Number"},
        {"key": "description", "type": "Text"},
    ]
    saved.settings["filters"] == {
        "foobar": {"widget": "minmax", "label": "Foo Bar"},
        "name": {"widget": "checkbox", "label": "Bar Foo"},
    }


def test_deleting_field_from_map_should_delete_filter(live_server, page, openmap):
    openmap.settings["properties"]["fields"] = [
        {"key": "name", "type": "String"},
        {"key": "foobar", "type": "Number"},
        {"key": "description", "type": "Text"},
    ]
    openmap.settings["properties"]["filters"] = {
        "foobar": {"widget": "minmax", "label": "Foo Bar"},
        "name": {"widget": "checkbox", "label": "Bar Foo"},
    }
    openmap.save()
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Map advanced properties").click()
    page.get_by_text("Fields, filters and keys").click()
    page.get_by_role("button", name="Delete this field").nth(1).click()
    page.get_by_role("button", name="OK").click()
    with page.expect_response(re.compile(r"./update/settings/.*")):
        page.get_by_role("button", name="Save").click()
    saved = Map.objects.first()
    assert saved.settings["properties"]["fields"] == [
        {"key": "name", "type": "String"},
        {"key": "description", "type": "Text"},
    ]
    saved.settings["properties"]["filters"] == {
        "name": {"widget": "checkbox", "label": "Bar Foo"},
    }
    page.locator(".edit-undo").click()
    with page.expect_response(re.compile(r"./update/settings/.*")):
        page.get_by_role("button", name="Save").click()
    saved = Map.objects.first()
    assert saved.settings["properties"]["fields"] == [
        {"key": "name", "type": "String"},
        {"key": "foobar", "type": "Number"},
        {"key": "description", "type": "Text"},
    ]
    saved.settings["properties"]["filters"] == {
        "foobar": {"widget": "minmax", "label": "Foo Bar"},
        "name": {"widget": "checkbox", "label": "Bar Foo"},
    }
