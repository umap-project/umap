import json
import re
from copy import deepcopy
from pathlib import Path

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


def test_can_add_field_on_map(live_server, page, openmap):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Map advanced properties").click()
    page.get_by_text("Manage Fields").click()
    page.get_by_role("button", name="Add a new field").click()
    page.get_by_role("textbox", name="Field Name ✔").fill("newfield")
    page.get_by_label("Field Type").select_option("Number")
    page.get_by_role("button", name="OK").click()
    with page.expect_response(re.compile(r".*/update/settings/")):
        page.get_by_role("button", name="Save").click()
    saved = Map.objects.get(pk=openmap.pk)
    assert saved.settings["properties"]["fields"] == [
        {"key": "newfield", "type": "Number"}
    ]


def test_can_add_field_on_datalayer(live_server, page, openmap, datalayer):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Edit", exact=True).click()
    page.get_by_text("Manage Fields").click()
    page.get_by_role("button", name="Add a new field").click()
    page.get_by_role("textbox", name="Field Name ✔").fill("newfield")
    page.get_by_label("Field Type").select_option("Number")
    page.get_by_role("button", name="OK").click()
    with page.expect_response(re.compile(r".*/datalayer/update/")):
        page.get_by_role("button", name="Save").click()
    saved = DataLayer.objects.first()
    assert saved.settings["fields"] == [
        {"key": "name", "type": "String"},
        {"key": "description", "type": "Text"},
        {"key": "newfield", "type": "Number"},
    ]


def test_edit_and_rename_field_from_datalayer(live_server, page, openmap):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA1)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Edit", exact=True).click()
    page.get_by_text("Manage Fields").click()
    page.get_by_role("button", name="Edit this field").first.click()
    page.get_by_role("textbox", name="Field Name ✔").fill("mytypenew")
    page.get_by_label("Field Type").select_option("Text")
    page.get_by_role("button", name="OK").click()
    with page.expect_response(re.compile(r".*/datalayer/update/")):
        page.get_by_role("button", name="Save").click()
    saved = DataLayer.objects.first()
    assert saved.settings["fields"] == [
        {
            "key": "mytypenew",
            "type": "Text",
        },
        {
            "key": "name",
            "type": "String",
        },
        {
            "key": "mynumber",
            "type": "String",
        },
        {
            "key": "mydate",
            "type": "String",
        },
    ]
    data = json.loads(Path(saved.geojson.path).read_text())
    assert data["features"][0]["properties"] == {
        "mydate": "2024/03/13 12:20:20",
        "mynumber": 12,
        "mytypenew": "odd",
        "name": "Point 1",
    }
    assert data["features"][1]["properties"] == {
        "mydate": "2024/04/14 12:19:17",
        "mynumber": 10,
        "mytypenew": "even",
        "name": "Point 2",
    }
    page.locator(".edit-undo").click()
    with page.expect_response(re.compile(r".*/datalayer/update/")):
        page.get_by_role("button", name="Save").click()
    saved = DataLayer.objects.first()
    assert saved.settings["fields"] == [
        {
            "key": "mytype",
            "type": "String",
        },
        {
            "key": "name",
            "type": "String",
        },
        {
            "key": "mynumber",
            "type": "String",
        },
        {
            "key": "mydate",
            "type": "String",
        },
    ]
    data = json.loads(Path(saved.geojson.path).read_text())
    assert data["features"][0]["properties"] == {
        "mydate": "2024/03/13 12:20:20",
        "mynumber": 12,
        "mytype": "odd",
        "name": "Point 1",
    }
    assert data["features"][1]["properties"] == {
        "mydate": "2024/04/14 12:19:17",
        "mynumber": 10,
        "mytype": "even",
        "name": "Point 2",
    }


def test_edit_and_rename_field_from_map(live_server, page, openmap):
    dl1 = DataLayerFactory(map=openmap, data=DATALAYER_DATA1)
    DataLayerFactory(map=openmap, data=DATALAYER_DATA2)
    openmap.settings["properties"]["fields"] = [
        {"key": "mytype", "type": "String"},
        {"key": "mynumber", "type": "Number"},
    ]
    openmap.save()
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Map advanced properties").click()
    page.get_by_text("Manage Fields").click()
    page.get_by_role("button", name="Edit this field").first.click()
    page.get_by_role("textbox", name="Field Name ✔").fill("mytypenew")
    page.get_by_label("Field Type").select_option("Text")
    page.get_by_role("button", name="OK").click()
    with page.expect_response(re.compile(r".*/datalayer/update/")):
        page.get_by_role("button", name="Save").click()
    saved = Map.objects.get(pk=openmap.pk)
    assert saved.settings["properties"]["fields"] == [
        {"key": "mytypenew", "type": "Text"},
        {"key": "mynumber", "type": "Number"},
    ]
    saved = DataLayer.objects.get(pk=dl1.pk)
    assert saved.settings["fields"] == [
        {
            "key": "name",
            "type": "String",
        },
        {
            "key": "mydate",
            "type": "String",
        },
    ]
    data = json.loads(Path(saved.geojson.path).read_text())
    assert data["features"][0]["properties"] == {
        "mydate": "2024/03/13 12:20:20",
        "mynumber": 12,
        "mytypenew": "odd",
        "name": "Point 1",
    }
    assert data["features"][1]["properties"] == {
        "mydate": "2024/04/14 12:19:17",
        "mynumber": 10,
        "mytypenew": "even",
        "name": "Point 2",
    }
    page.locator(".edit-undo").click()

    with page.expect_response(re.compile(rf".*/datalayer/update/{dl1.pk}")):
        with page.expect_response(re.compile(r".*/update/settings/")):
            page.get_by_role("button", name="Save").click()
    saved = Map.objects.get(pk=openmap.pk)
    assert saved.settings["properties"]["fields"] == [
        {"key": "mytype", "type": "String"},
        {"key": "mynumber", "type": "Number"},
    ]
    saved = DataLayer.objects.get(pk=dl1.pk)
    assert saved.settings["fields"] == [
        {
            "key": "name",
            "type": "String",
        },
        {
            "key": "mydate",
            "type": "String",
        },
    ]
    data = json.loads(Path(saved.geojson.path).read_text())
    assert data["features"][0]["properties"] == {
        "mydate": "2024/03/13 12:20:20",
        "mynumber": 12,
        "mytype": "odd",
        "name": "Point 1",
    }
    assert data["features"][1]["properties"] == {
        "mydate": "2024/04/14 12:19:17",
        "mynumber": 10,
        "mytype": "even",
        "name": "Point 2",
    }


def test_delete_field_from_datalayer(live_server, page, openmap):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA1)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Edit", exact=True).click()
    page.get_by_text("Manage Fields").click()
    page.get_by_role("button", name="Delete this field").first.click()
    page.get_by_role("button", name="OK").click()
    with page.expect_response(re.compile(r".*/datalayer/update/")):
        page.get_by_role("button", name="Save").click()
    saved = DataLayer.objects.first()
    assert saved.settings["fields"] == [
        {
            "key": "name",
            "type": "String",
        },
        {
            "key": "mynumber",
            "type": "String",
        },
        {
            "key": "mydate",
            "type": "String",
        },
    ]
    data = json.loads(Path(saved.geojson.path).read_text())
    assert data["features"][0]["properties"] == {
        "mydate": "2024/03/13 12:20:20",
        "mynumber": 12,
        "name": "Point 1",
    }
    assert data["features"][1]["properties"] == {
        "mydate": "2024/04/14 12:19:17",
        "mynumber": 10,
        "name": "Point 2",
    }
    page.locator(".edit-undo").click()
    with page.expect_response(re.compile(r".*/datalayer/update/")):
        page.get_by_role("button", name="Save").click()
    saved = DataLayer.objects.first()
    assert saved.settings["fields"] == [
        {
            "key": "mytype",
            "type": "String",
        },
        {
            "key": "name",
            "type": "String",
        },
        {
            "key": "mynumber",
            "type": "String",
        },
        {
            "key": "mydate",
            "type": "String",
        },
    ]
    data = json.loads(Path(saved.geojson.path).read_text())
    assert data["features"][0]["properties"] == {
        "mydate": "2024/03/13 12:20:20",
        "mynumber": 12,
        "name": "Point 1",
        "mytype": "odd",
    }
    assert data["features"][1]["properties"] == {
        "mydate": "2024/04/14 12:19:17",
        "mynumber": 10,
        "name": "Point 2",
        "mytype": "even",
    }


def test_delete_field_from_map(live_server, page, openmap):
    dl1 = DataLayerFactory(map=openmap, data=DATALAYER_DATA1)
    DataLayerFactory(map=openmap, data=DATALAYER_DATA2)
    openmap.settings["properties"]["fields"] = [
        {"key": "mytype", "type": "String"},
        {"key": "mynumber", "type": "Number"},
    ]
    openmap.save()
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Map advanced properties").click()
    page.get_by_text("Manage Fields").click()
    # Delete field mytype
    page.get_by_role("button", name="Delete this field").first.click()
    page.get_by_role("button", name="OK").click()
    with page.expect_response(re.compile(r".*/datalayer/update/")):
        page.get_by_role("button", name="Save").click()
    saved = Map.objects.get(pk=openmap.pk)
    assert saved.settings["properties"]["fields"] == [
        {"key": "mynumber", "type": "Number"},
    ]
    saved = DataLayer.objects.get(pk=dl1.pk)
    assert saved.settings["fields"] == [
        {
            "key": "name",
            "type": "String",
        },
        {
            "key": "mydate",
            "type": "String",
        },
    ]
    data = json.loads(Path(saved.geojson.path).read_text())
    assert data["features"][0]["properties"] == {
        "mydate": "2024/03/13 12:20:20",
        "mynumber": 12,
        "name": "Point 1",
    }
    assert data["features"][1]["properties"] == {
        "mydate": "2024/04/14 12:19:17",
        "mynumber": 10,
        "name": "Point 2",
    }
    page.locator(".edit-undo").click()
    with page.expect_response(re.compile(r"./update/settings/.*")):
        with page.expect_response(re.compile(rf".*/datalayer/update/{dl1.pk}/")):
            page.get_by_role("button", name="Save").click()
    saved = Map.objects.get(pk=openmap.pk)
    assert saved.settings["properties"]["fields"] == [
        {"key": "mytype", "type": "String"},
        {"key": "mynumber", "type": "Number"},
    ]
    saved = DataLayer.objects.get(pk=dl1.pk)
    assert saved.settings["fields"] == [
        {
            "key": "name",
            "type": "String",
        },
        {
            "key": "mydate",
            "type": "String",
        },
    ]
    data = json.loads(Path(saved.geojson.path).read_text())
    assert data["features"][0]["properties"] == {
        "mydate": "2024/03/13 12:20:20",
        "mynumber": 12,
        "name": "Point 1",
        "mytype": "odd",
    }
    assert data["features"][1]["properties"] == {
        "mydate": "2024/04/14 12:19:17",
        "mynumber": 10,
        "name": "Point 2",
        "mytype": "even",
    }


def test_delete_field_from_datalayer_also_in_map(live_server, page, openmap):
    # mytype exist both on map and datalayer 1
    # deleting the field in the datalayer should not delete the data, as the field
    # is also defined on the map
    data = deepcopy(DATALAYER_DATA1)
    data["_umap_options"]["fields"] = [
        {"key": "mytype", "type": "String"},
        {"key": "mynumber", "type": "Number"},
        {"key": "name", "type": "String"},
        {"key": "mydate", "type": "Date"},
    ]
    DataLayerFactory(map=openmap, data=data)
    openmap.settings["properties"]["fields"] = [
        {"key": "mytype", "type": "String"},
    ]
    openmap.save()
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Edit", exact=True).first.click()
    page.get_by_text("Manage Fields").click()
    page.get_by_role("button", name="Delete this field").first.click()
    page.get_by_role("button", name="OK").click()
    with page.expect_response(re.compile(r".*/datalayer/update/")):
        page.get_by_role("button", name="Save").click()
    saved = DataLayer.objects.first()
    assert saved.settings["fields"] == [
        {"key": "mynumber", "type": "Number"},
        {"key": "name", "type": "String"},
        {"key": "mydate", "type": "Date"},
    ]
    data = json.loads(Path(saved.geojson.path).read_text())
    assert data["features"][0]["properties"] == {
        "mydate": "2024/03/13 12:20:20",
        "mynumber": 12,
        "name": "Point 1",
        "mytype": "odd",
    }
    assert data["features"][1]["properties"] == {
        "mydate": "2024/04/14 12:19:17",
        "mynumber": 10,
        "name": "Point 2",
        "mytype": "even",
    }


def test_can_change_field_type_with_remote_data(live_server, page, openmap, tilelayer):
    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "Point 2", "myenum": "foofoo,bababar"},
                "geometry": {
                    "type": "Point",
                    "coordinates": [4.3375, 11.2707],
                },
            },
            {
                "type": "Feature",
                "properties": {"name": "Point 1", "myenum": "feefee,bababar"},
                "geometry": {
                    "type": "Point",
                    "coordinates": [4.3375, 12.2707],
                },
            },
        ],
    }

    def handle(route):
        route.fulfill(json=data)

    DataLayerFactory(
        map=openmap,
        settings={
            "remoteData": {
                "url": "https://remote.org/data.json",
                "format": "geojson",
            },
        },
    )
    # Intercept the route to the proxy
    page.route("https://remote.org/data.json", handle)

    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#9/12.0017/4.4824")
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Edit", exact=True).click()
    page.locator("summary").filter(has_text="Manage Fields").click()
    # Click on "myenum" edit button
    page.get_by_role("button", name="Edit this field").nth(1).click()
    page.get_by_label("Field Type").select_option("Enum")
    page.get_by_role("button", name="OK").click()
    # Click on "myenum" add filter button
    page.get_by_role("button", name="Add a filter for this field").nth(1).click()
    page.get_by_role("button", name="OK").click()
    page.get_by_role("button", name="Open browser").click()
    page.get_by_text("Filters", exact=True).click()
    expect(page.locator(".panel .umap-filter label")).to_contain_text(
        ["bababar", "feefee", "foofoo"]
    )


def test_boolean_field_should_display_a_switch_in_feature_form(
    live_server, page, openmap, tilelayer
):
    openmap.settings["properties"]["fields"] = [
        {"key": "mystring", "type": "String"},
        {"key": "mynumber", "type": "Number"},
        {"key": "mybool", "type": "Boolean"},
    ]
    openmap.save()
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Draw a marker (Ctrl+M)").click()
    page.locator("#map").click()
    panel = page.locator(".panel")
    expect(panel.locator(".umap-field-mynumber input")).to_have_attribute(
        "type", "number"
    )
    expect(panel.locator(".umap-field-mybool.with-switch")).to_be_visible()
