import json
import re
from copy import deepcopy
from pathlib import Path

import pytest

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
        {
            "key": "mytypenew",
            "type": "Text",
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


def test_edit_and_rename_field_from_map(live_server, page, openmap):
    dl1 = DataLayerFactory(map=openmap, data=DATALAYER_DATA1)
    dl2 = DataLayerFactory(map=openmap, data=DATALAYER_DATA2)
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
        {"key": "mynumber", "type": "Number"},
        {"key": "mytypenew", "type": "Text"},
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


def test_delete_field_from_map(live_server, page, openmap):
    dl1 = DataLayerFactory(map=openmap, data=DATALAYER_DATA1)
    dl2 = DataLayerFactory(map=openmap, data=DATALAYER_DATA2)
    openmap.settings["properties"]["fields"] = [
        {"key": "mytype", "type": "String"},
        {"key": "mynumber", "type": "Number"},
    ]
    openmap.save()
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Map advanced properties").click()
    page.get_by_text("Manage Fields").click()
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


def test_delete_field_from_datalayer_also_in_map(live_server, page, openmap):
    # mytype exist both on map and datalayer 1
    # deleting the field in the datalayer should not delete the data, at the field
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
