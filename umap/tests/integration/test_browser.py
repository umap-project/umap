import re
from copy import deepcopy
from time import sleep

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
                "name": "one point in france",
                "foo": "point",
                "bar": "one",
                "label": "this is label one",
            },
            "geometry": {"type": "Point", "coordinates": [3.339844, 46.920255]},
        },
        {
            "type": "Feature",
            "properties": {
                "name": "one polygon in greenland",
                "foo": "polygon",
                "bar": "two",
                "label": "this is label two",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [-41.3, 71.8],
                        [-43.5, 70.8],
                        [-39.3, 70.9],
                        [-37.7, 72.2],
                        [-41.3, 71.8],
                    ]
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {
                "name": "one line in new zeland",
                "foo": "line",
                "bar": "three",
                "label": "this is label three",
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [176.1, -38.6],
                    [172.9, -43.3],
                    [168.3, -45.2],
                ],
            },
        },
    ],
    "_umap_options": {
        "displayOnLoad": True,
        "browsable": True,
        "name": "Calque 1",
    },
}


@pytest.fixture
def bootstrap(map, live_server):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA)


def test_data_browser_should_be_open(live_server, page, bootstrap, map):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    panel = page.locator(".panel.left.on")
    expect(panel).to_have_class(re.compile(".*expanded.*"))
    expect(panel.locator(".umap-browser")).to_be_visible()
    expect(page.get_by_text("one point in france")).to_be_visible()
    expect(page.get_by_text("one line in new zeland")).to_be_visible()
    expect(page.get_by_text("one polygon in greenland")).to_be_visible()


def test_data_browser_should_be_filterable(live_server, page, bootstrap, map):
    page.goto(f"{live_server.url}{map.get_absolute_url()}#2/19/-2")
    expect(page.get_by_title("Features in this layer: 3")).to_be_visible()
    markers = page.locator(".leaflet-marker-icon")
    paths = page.locator(".leaflet-overlay-pane path")
    expect(markers).to_have_count(1)
    expect(paths).to_have_count(2)
    page.locator(".filters summary").click()
    filter_ = page.locator("input[name='filter']")
    expect(filter_).to_be_visible()
    filter_.type("poly")
    expect(page.get_by_title("Features in this layer: 1/3")).to_be_visible()
    expect(page.get_by_title("Features in this layer: 1/3")).to_have_text("(1/3)")
    expect(page.get_by_text("one point in france")).to_be_hidden()
    expect(page.get_by_text("one line in new zeland")).to_be_hidden()
    expect(page.get_by_text("one polygon in greenland")).to_be_visible()
    expect(markers).to_have_count(0)  # Hidden by filter
    expect(paths).to_have_count(1)  # Only polygon
    # Empty the filter
    filter_.fill("")
    filter_.blur()
    expect(markers).to_have_count(1)
    expect(paths).to_have_count(2)
    filter_.type("point")
    expect(page.get_by_text("one point in france")).to_be_visible()
    expect(page.get_by_text("one line in new zeland")).to_be_hidden()
    expect(page.get_by_text("one polygon in greenland")).to_be_hidden()
    expect(markers).to_have_count(1)
    expect(paths).to_have_count(0)


def test_filter_uses_layer_setting_if_any(live_server, page, bootstrap, map):
    datalayer = map.datalayer_set.first()
    datalayer.settings["labelKey"] = "foo"
    datalayer.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}#2/19/-2")
    expect(page.get_by_title("Features in this layer: 3")).to_be_visible()
    markers = page.locator(".leaflet-marker-icon")
    paths = page.locator(".leaflet-overlay-pane path")
    expect(markers).to_have_count(1)
    expect(paths).to_have_count(2)
    expect(page.get_by_text("point")).to_be_visible()
    expect(page.get_by_text("polygon")).to_be_visible()
    expect(page.get_by_text("line")).to_be_visible()
    page.locator(".filters summary").click()
    filter_ = page.locator("input[name='filter']")
    expect(filter_).to_be_visible()
    filter_.type("po")
    expect(page.get_by_title("Features in this layer: 2/3")).to_be_visible()
    expect(page.get_by_title("Features in this layer: 2/3")).to_have_text("(2/3)")
    expect(page.get_by_text("line")).to_be_hidden()
    expect(page.get_by_text("point")).to_be_visible()
    expect(page.get_by_text("polygon")).to_be_visible()
    expect(markers).to_have_count(1)
    expect(paths).to_have_count(1)  # Only polygon
    # Empty the filter
    filter_.fill("")
    filter_.blur()
    expect(markers).to_have_count(1)
    expect(paths).to_have_count(2)
    filter_.type("point")
    expect(page.get_by_text("point")).to_be_visible()
    expect(page.get_by_text("line")).to_be_hidden()
    expect(page.get_by_text("polygon")).to_be_hidden()
    expect(markers).to_have_count(1)
    expect(paths).to_have_count(0)


def test_filter_works_with_variable_in_labelKey(live_server, page, map):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.save()
    data = deepcopy(DATALAYER_DATA)
    data["_umap_options"]["labelKey"] = "{name} ({bar})"
    DataLayerFactory(map=map, data=data)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#2/19/-2")
    expect(page.get_by_title("Features in this layer: 3")).to_be_visible()
    markers = page.locator(".leaflet-marker-icon")
    paths = page.locator(".leaflet-overlay-pane path")
    expect(markers).to_have_count(1)
    expect(paths).to_have_count(2)
    expect(page.get_by_text("one point in france (one)")).to_be_visible()
    expect(page.get_by_text("one line in new zeland (three)")).to_be_visible()
    expect(page.get_by_text("one polygon in greenland (two)")).to_be_visible()
    page.locator(".filters summary").click()
    filter_ = page.locator("input[name='filter']")
    expect(filter_).to_be_visible()
    filter_.type("two")
    expect(page.get_by_title("Features in this layer: 1/3")).to_be_visible()
    expect(page.get_by_title("Features in this layer: 1/3")).to_have_text("(1/3)")
    expect(page.get_by_text("one polygon in greenland (two)")).to_be_visible()
    expect(page.get_by_text("one line in new zeland (three)")).to_be_hidden()
    expect(page.get_by_text("one point in france (one)")).to_be_hidden()
    expect(markers).to_have_count(0)
    expect(paths).to_have_count(1)  # Only polygon


def test_filter_works_with_missing_name(live_server, page, map):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.save()
    data = deepcopy(DATALAYER_DATA)
    del data["features"][0]["properties"]["name"]
    DataLayerFactory(map=map, data=data, name="foobar")
    page.goto(f"{live_server.url}{map.get_absolute_url()}#2/19/-2")
    expect(page.get_by_title("Features in this layer: 3")).to_be_visible()
    markers = page.locator(".leaflet-marker-icon")
    paths = page.locator(".leaflet-overlay-pane path")
    expect(markers).to_have_count(1)
    expect(paths).to_have_count(2)
    page.locator(".filters summary").click()
    filter_ = page.locator("input[name='filter']")
    expect(filter_).to_be_visible()
    filter_.type("foob")
    expect(markers).to_have_count(1)
    expect(paths).to_have_count(0)


def test_data_browser_can_show_only_visible_features(live_server, page, bootstrap, map):
    # Zoom on France
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/51.000/2.000")
    page.locator(".filters summary").click()
    el = page.get_by_text("Current map view")
    expect(el).to_be_visible()
    el.click()
    expect(page.get_by_text("one point in france")).to_be_visible()
    expect(page.get_by_text("one line in new zeland")).to_be_hidden()
    expect(page.get_by_text("one polygon in greenland")).to_be_hidden()


def test_data_browser_can_mix_filter_and_bbox(live_server, page, bootstrap, map):
    # Zoom on north west
    page.goto(f"{live_server.url}{map.get_absolute_url()}#4/61.98/-2.68")
    page.locator(".filters summary").click()
    el = page.get_by_text("Current map view")
    expect(el).to_be_visible()
    el.click()
    expect(page.get_by_text("one point in france")).to_be_visible()
    expect(page.get_by_text("one polygon in greenland")).to_be_visible()
    expect(page.get_by_text("one line in new zeland")).to_be_hidden()
    el = page.locator("input[name='filter']")
    expect(el).to_be_visible()
    el.type("poly")
    expect(page.get_by_text("one polygon in greenland")).to_be_visible()
    expect(page.get_by_text("one point in france")).to_be_hidden()
    expect(page.get_by_text("one line in new zeland")).to_be_hidden()


def test_data_browser_bbox_limit_should_be_dynamic(live_server, page, bootstrap, map):
    # Zoom on Europe
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/51.000/2.000")
    page.locator(".filters summary").click()
    el = page.get_by_text("Current map view")
    expect(el).to_be_visible()
    el.click()
    expect(page.get_by_text("one point in france")).to_be_visible()
    expect(page.get_by_text("one line in new zeland")).to_be_hidden()
    expect(page.get_by_text("one polygon in greenland")).to_be_hidden()
    unzoom = page.get_by_role("button", name="Zoom out")
    expect(unzoom).to_be_visible()
    # Unzoom until we see the Greenland
    unzoom.click()
    sleep(0.5)  # Zooming is async
    unzoom.click()
    sleep(0.5)  # Zooming is async
    unzoom.click()
    sleep(0.5)  # Zooming is async
    expect(page.get_by_text("one point in france")).to_be_visible()
    expect(page.get_by_text("one polygon in greenland")).to_be_visible()
    expect(page.get_by_text("one line in new zeland")).to_be_hidden()


def test_data_browser_bbox_filter_should_be_persistent(
    live_server, page, bootstrap, map
):
    # Zoom on Europe
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/51.000/2.000")
    page.locator(".filters summary").click()
    el = page.get_by_text("Current map view")
    expect(el).to_be_visible()
    el.click()
    browser = page.locator(".panel.left.on")
    expect(browser.get_by_text("one point in france")).to_be_visible()
    expect(browser.get_by_text("one line in new zeland")).to_be_hidden()
    expect(browser.get_by_text("one polygon in greenland")).to_be_hidden()
    # Close and reopen the browser to make sure this settings is persistent
    close = browser.get_by_title("Close")
    close.click()
    expect(browser).to_be_hidden()
    sleep(0.5)
    expect(browser.get_by_text("one point in france")).to_be_hidden()
    expect(browser.get_by_text("one line in new zeland")).to_be_hidden()
    expect(browser.get_by_text("one polygon in greenland")).to_be_hidden()
    page.get_by_title("Open browser").click()
    expect(browser.get_by_text("one point in france")).to_be_visible()
    expect(browser.get_by_text("one line in new zeland")).to_be_hidden()
    expect(browser.get_by_text("one polygon in greenland")).to_be_hidden()


def test_data_browser_bbox_filtered_is_clickable(live_server, page, bootstrap, map):
    popup = page.locator(".leaflet-popup")
    # Zoom on Europe
    page.goto(f"{live_server.url}{map.get_absolute_url()}#6/51.000/2.000")
    page.locator(".filters summary").click()
    el = page.get_by_text("Current map view")
    expect(el).to_be_visible()
    el.click()
    browser = page.locator(".panel.left.on")
    expect(browser.get_by_text("one point in france")).to_be_visible()
    expect(browser.get_by_text("one line in new zeland")).to_be_hidden()
    expect(browser.get_by_text("one polygon in greenland")).to_be_hidden()
    expect(popup).to_be_hidden()
    browser.get_by_text("one point in france").click()
    expect(popup).to_be_visible()
    expect(popup.get_by_text("one point in france")).to_be_visible()


def test_data_browser_with_variable_in_name(live_server, page, bootstrap, map):
    # Include a variable
    map.settings["properties"]["labelKey"] = "{name} ({foo})"
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}#2/19/-2")
    expect(page.get_by_text("one point in france (point)")).to_be_visible()
    expect(page.get_by_text("one line in new zeland (line)")).to_be_visible()
    expect(page.get_by_text("one polygon in greenland (polygon)")).to_be_visible()
    page.locator(".filters summary").click()
    filter_ = page.locator("input[name='filter']")
    expect(filter_).to_be_visible()
    filter_.type("foobar")  # Hide all
    expect(page.get_by_text("one point in france (point)")).to_be_hidden()
    expect(page.get_by_text("one line in new zeland (line)")).to_be_hidden()
    expect(page.get_by_text("one polygon in greenland (polygon)")).to_be_hidden()
    # Empty back the filter
    filter_.fill("")
    filter_.blur()
    expect(page.get_by_text("one point in france (point)")).to_be_visible()
    expect(page.get_by_text("one line in new zeland (line)")).to_be_visible()
    expect(page.get_by_text("one polygon in greenland (polygon)")).to_be_visible()


def test_should_sort_features_in_natural_order(live_server, map, page):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.save()
    datalayer_data = deepcopy(DATALAYER_DATA)
    datalayer_data["features"][0]["properties"]["name"] = "9. a marker"
    datalayer_data["features"][1]["properties"]["name"] = "1. a poly"
    datalayer_data["features"][2]["properties"]["name"] = "100. a line"
    DataLayerFactory(map=map, data=datalayer_data)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    features = page.locator(".umap-browser .datalayer li")
    expect(features).to_have_count(3)
    expect(features.nth(0)).to_have_text("1. a poly")
    expect(features.nth(1)).to_have_text("9. a marker")
    expect(features.nth(2)).to_have_text("100. a line")


def test_should_redraw_list_on_feature_delete(live_server, openmap, page, bootstrap):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}#2/19/-2")
    # Enable edit
    page.get_by_role("button", name="Edit").click()
    buttons = page.locator(".umap-browser .datalayer li .icon-delete")
    expect(buttons).to_have_count(3)
    buttons.first.click()
    expect(buttons).to_have_count(2)
    page.locator(".edit-undo").click()
    expect(buttons).to_have_count(3)


def test_should_show_header_for_display_on_load_false(
    live_server, page, bootstrap, map, datalayer
):
    datalayer.settings["displayOnLoad"] = False
    datalayer.settings["name"] = "This layer is not loaded"
    datalayer.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    browser = page.locator(".umap-browser")
    expect(browser).to_be_visible()
    expect(browser.get_by_text("This layer is not loaded")).to_be_visible()


def test_should_use_color_variable(live_server, map, page):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.settings["properties"]["color"] = "{mycolor}"
    map.save()
    datalayer_data = deepcopy(DATALAYER_DATA)
    datalayer_data["features"][0]["properties"]["mycolor"] = "DarkRed"
    datalayer_data["features"][2]["properties"]["mycolor"] = "DarkGreen"
    DataLayerFactory(map=map, data=datalayer_data)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    features = page.locator(".umap-browser .datalayer li .feature-color")
    expect(features).to_have_count(3)
    # DarkGreen
    expect(features.nth(0)).to_have_css("background-color", "rgb(0, 100, 0)")
    # DarkRed
    expect(features.nth(1)).to_have_css("background-color", "rgb(139, 0, 0)")
    # DarkBlue (default color)
    expect(features.nth(2)).to_have_css("background-color", "rgb(0, 0, 139)")


def test_should_allow_to_toggle_datalayer_visibility(live_server, map, page, bootstrap):
    page.goto(f"{live_server.url}{map.get_absolute_url()}#2/19/-2")
    markers = page.locator(".leaflet-marker-icon")
    paths = page.locator(".leaflet-overlay-pane path")
    expect(markers).to_have_count(1)
    expect(paths).to_have_count(2)
    toggle = page.locator(".umap-browser").get_by_title("Show/hide layer")
    toggle.click()
    expect(markers).to_have_count(0)
    expect(paths).to_have_count(0)


def test_should_have_edit_buttons_in_edit_mode(live_server, openmap, page, bootstrap):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}")
    browser = page.locator(".umap-browser")
    edit_layer = browser.get_by_title("Edit", exact=True)
    in_table = browser.get_by_title("Edit properties in a table")
    delete_layer = browser.get_by_title("Delete layer")
    edit_feature = browser.get_by_title("Edit this feature")
    delete_feature = browser.get_by_title("Delete this feature")
    expect(edit_layer).to_be_hidden()
    expect(in_table).to_be_hidden()
    expect(delete_layer).to_be_hidden()
    # Does not work
    # to_have_count does not seem to case about the elements being visible or not
    # and to_be_hidden is not happy if the selector resolve to more than on element
    # expect(edit_feature).to_have_count(0)
    # expect(delete_feature).to_be_hidden()
    # Switch to edit mode
    page.get_by_role("button", name="Edit").click()
    expect(edit_layer).to_be_visible()
    expect(in_table).to_be_visible()
    expect(delete_layer).to_be_visible()
    expect(edit_feature).to_have_count(3)
    expect(delete_feature).to_have_count(3)


def test_main_toolbox_toggle_all_layers(live_server, map, page):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.save()
    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "one point"},
                "geometry": {"type": "Point", "coordinates": [3.33, 46.92]},
            },
        ],
    }
    DataLayerFactory(map=map, data=data)
    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "one other point"},
                "geometry": {"type": "Point", "coordinates": [3.34, 46.94]},
            },
        ],
    }
    DataLayerFactory(map=map, data=data)
    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "another point"},
                "geometry": {"type": "Point", "coordinates": [3.35, 46.95]},
            },
        ],
        "_umap_options": {"displayOnLoad": False},
    }
    DataLayerFactory(map=map, data=data, settings={"displayOnLoad": False})
    page.goto(f"{live_server.url}{map.get_absolute_url()}#10/46.93/3.33")
    markers = page.locator(".leaflet-marker-icon")
    expect(markers).to_have_count(2)
    # Only one is off
    expect(page.locator(".datalayer.off")).to_have_count(1)

    # Click on button
    page.locator(".umap-browser").get_by_title("Show/hide all layers").click()
    # Should have hidden the two other layers
    expect(page.locator(".datalayer.off")).to_have_count(3)
    expect(markers).to_have_count(0)

    # Click again
    page.locator(".umap-browser").get_by_title("Show/hide all layers").click()
    # Should shown all layers
    expect(page.locator(".datalayer.off")).to_have_count(0)
    expect(markers).to_have_count(3)

    # Click again
    page.locator(".umap-browser").get_by_title("Show/hide all layers").click()
    # Should hidden again all layers
    expect(page.locator(".datalayer.off")).to_have_count(3)
    expect(markers).to_have_count(0)


def test_honour_the_label_fields_settings(live_server, map, page, bootstrap, settings):
    settings.UMAP_LABEL_KEYS = ["label", "name"]
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.locator(".panel").get_by_text("this is label one")).to_be_visible()
    expect(page.locator(".panel").get_by_text("this is label two")).to_be_visible()
    expect(page.locator(".panel").get_by_text("this is label three")).to_be_visible()
