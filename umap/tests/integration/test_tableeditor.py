import json
import re
from pathlib import Path

from playwright.sync_api import expect

from umap.models import DataLayer

from ..base import DataLayerFactory

DATALAYER_DATA = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "mytype": "even",
                "name": "Point 2",
                "mynumber": 10,
                "myboolean": True,
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
                "myboolean": False,
                "mydate": "2024/03/13 12:20:20",
            },
            "geometry": {"type": "Point", "coordinates": [3.55957, 49.767074]},
        },
        {
            "type": "Feature",
            "properties": {
                "mytype": "even",
                "name": "Point 4",
                "mynumber": 10,
                "myboolean": "true",
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


def test_table_editor(live_server, openmap, datalayer, page):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("link", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit properties in a table").click()
    page.get_by_text("Add a new property").click()
    page.locator("dialog").locator("input").fill("newprop")
    page.locator("dialog").get_by_role("button", name="OK").click()
    page.locator('input[name="newprop"]').fill("newvalue")
    page.once("dialog", lambda dialog: dialog.accept())
    page.hover(".umap-table-editor .tcell")
    page.get_by_title("Delete this property on all").first.click()
    page.locator("dialog").get_by_role("button", name="OK").click()
    with page.expect_response(re.compile(r".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save").click()
    saved = DataLayer.objects.last()
    data = json.loads(Path(saved.geojson.path).read_text())
    assert data["features"][0]["properties"]["newprop"] == "newvalue"
    assert "name" not in data["features"][0]["properties"]


def test_delete_rows_by_equality(live_server, openmap, page):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    markers = page.locator(".leaflet-marker-icon .icon_container")
    expect(markers).to_have_count(4)
    page.get_by_role("link", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit properties in a table").click()
    rows = page.locator(".umap-table-editor .trow")
    expect(rows).to_have_count(4)
    page.get_by_text("Delete rows").click()
    page.get_by_role("combobox").click()
    page.get_by_role("combobox").fill("mytype=odd")
    page.get_by_role("button", name="OK").click()
    expect(rows).to_have_count(2)
    expect(markers).to_have_count(2)
    expect(page.locator('.umap-table-editor input[name="mytype"]').first).to_have_value(
        "even"
    )


def test_delete_rows_by_non_equality(live_server, openmap, page):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    markers = page.locator(".leaflet-marker-icon .icon_container")
    expect(markers).to_have_count(4)
    page.get_by_role("link", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit properties in a table").click()
    rows = page.locator(".umap-table-editor .trow")
    expect(rows).to_have_count(4)
    page.get_by_text("Delete rows").click()
    page.get_by_role("combobox").click()
    page.get_by_role("combobox").fill("mytype!=odd")
    page.get_by_role("button", name="OK").click()
    expect(rows).to_have_count(2)
    expect(markers).to_have_count(2)
    expect(page.locator('.umap-table-editor input[name="mytype"]').first).to_have_value(
        "odd"
    )
