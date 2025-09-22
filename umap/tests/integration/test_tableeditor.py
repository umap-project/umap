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
            "id": "poin2",  # Must be exactly 5 chars long so the frontend will keep it
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
            "id": "poin1",
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
            "id": "poin4",
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
            "id": "poin3",
        },
    ],
    "_umap_options": {
        "name": "Calque 2",
    },
}


def test_table_editor(live_server, openmap, datalayer, page):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit properties in a table").click()
    page.locator("td[data-property=description]").dblclick()
    page.locator('textarea[name="description"]').fill("nice new description")
    page.get_by_text("Add a new field").click()
    page.locator("dialog").locator("input").fill("newprop")
    page.locator("dialog").get_by_role("button", name="OK").click()
    page.locator("td").nth(2).dblclick()
    page.locator('input[name="newprop"]').fill("newvalue")
    page.wait_for_timeout(300)  # Time for the input debounce.
    page.keyboard.press("Enter")
    page.locator("thead button[data-property=name]").click()
    page.get_by_role("button", name="Delete this column").click()
    page.locator("dialog").get_by_role("button", name="OK").click()
    with page.expect_response(re.compile(r".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save").click()
    saved = DataLayer.objects.last()
    data = json.loads(Path(saved.geojson.path).read_text())
    assert data["features"][0]["properties"]["description"] == "nice new description"
    assert data["features"][0]["properties"]["newprop"] == "newvalue"
    assert "name" not in data["features"][0]["properties"]


def test_cannot_add_existing_property_name(live_server, openmap, datalayer, page):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit properties in a table").click()
    page.get_by_text("Add a new field").click()
    page.locator("dialog").locator("input").fill("name")
    page.get_by_role("button", name="OK").click()
    expect(page.get_by_role("dialog")).to_contain_text(
        "This name already exists: “name”"
    )
    expect(page.locator("table th button[data-property=name]")).to_have_count(1)


def test_cannot_add_property_with_a_dot(live_server, openmap, datalayer, page):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit properties in a table").click()
    page.get_by_text("Add a new field").click()
    page.locator("dialog").locator("input").fill("foo.bar")
    page.get_by_role("button", name="OK").click()
    expect(page.get_by_role("dialog")).to_contain_text(
        "Name “foo.bar” should not contain a dot."
    )
    expect(page.locator("table th button[data-property=name]")).to_have_count(1)


def test_rename_property(live_server, openmap, page):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#6/48.093/1.890")
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit properties in a table").click()
    expect(page.locator("table th button[data-property=mytype]")).to_have_count(1)
    page.locator("thead button[data-property=mytype]").click()
    page.get_by_text("Edit this column").click()
    page.locator("dialog").locator("input").fill("mynewtype")
    page.get_by_role("button", name="OK").click()
    expect(page.locator("table th button[data-property=mynewtype]")).to_have_count(1)
    expect(page.locator("table th button[data-property=mytype]")).to_have_count(0)

    page.locator(".panel.full").get_by_role("button", name="Close").click()
    page.locator(".leaflet-marker-icon").first.click(button="right")
    page.get_by_role("button", name="Toggle edit mode (⇧+Click)").click()
    expect(page.locator(".panel.right .umap-field-mynewtype")).to_be_visible()
    expect(page.locator(".panel.right .umap-field-mytype")).to_be_hidden()
    page.locator(".edit-undo").click()
    page.locator(".panel.right").get_by_role("button", name="Close").click()
    page.locator(".leaflet-marker-icon").first.click(button="right")
    page.get_by_role("button", name="Toggle edit mode (⇧+Click)").click()
    expect(page.locator(".panel.right .umap-field-mynewtype")).to_be_hidden()
    expect(page.locator(".panel.right .umap-field-mytype")).to_be_visible()


def test_delete_property(live_server, openmap, page):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#6/48.093/1.890")
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit properties in a table").click()
    expect(page.locator("table th button[data-property=mytype]")).to_have_count(1)
    page.locator("thead button[data-property=mytype]").click()
    page.get_by_text("Delete this column").click()
    page.get_by_role("button", name="OK").click()
    expect(page.locator("table th button[data-property=mytype]")).to_have_count(0)

    page.locator(".panel.full").get_by_role("button", name="Close").click()
    page.locator(".leaflet-marker-icon").first.click(button="right")
    page.get_by_role("button", name="Toggle edit mode (⇧+Click)").click()
    expect(page.locator(".panel.right .umap-field-mytype")).to_be_hidden()
    page.locator(".edit-undo").click()
    page.locator(".panel.right").get_by_role("button", name="Close").click()
    page.locator(".leaflet-marker-icon").first.click(button="right")
    page.get_by_role("button", name="Toggle edit mode (⇧+Click)").click()
    expect(page.locator(".panel.right .umap-field-mytype")).to_be_visible()


def test_delete_selected_rows(live_server, openmap, page):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#6/48.093/1.890")
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit properties in a table").click()
    expect(page.locator("tbody tr")).to_have_count(4)
    expect(page.locator(".leaflet-marker-icon")).to_have_count(4)
    page.locator("tr[data-feature=poin2]").get_by_role("checkbox").check()
    page.get_by_role("button", name="Delete selected rows").click()
    page.get_by_role("button", name="OK").click()
    expect(page.locator("tbody tr")).to_have_count(3)
    expect(page.locator(".leaflet-marker-icon")).to_have_count(3)


def test_delete_all_rows(live_server, openmap, page):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#6/48.093/1.890")
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit properties in a table").click()
    expect(page.locator("tbody tr")).to_have_count(4)
    expect(page.locator(".leaflet-marker-icon")).to_have_count(4)
    page.locator("thead").get_by_role("checkbox").check()
    page.get_by_role("button", name="Delete selected rows").click()
    page.get_by_role("button", name="OK").click()
    expect(page.locator("tbody tr")).to_have_count(0)
    expect(page.locator(".leaflet-marker-icon")).to_have_count(0)


def test_filter_and_delete_rows(live_server, openmap, page):
    DataLayerFactory(map=openmap, data=DATALAYER_DATA)
    panel = page.locator(".panel.left.on")
    table = page.locator(".panel.full table")
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit#6/48.093/1.890")
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit properties in a table").click()
    expect(table.locator("tbody tr")).to_have_count(4)
    expect(page.locator(".leaflet-marker-icon")).to_have_count(4)
    table.locator("thead button[data-property=mytype]").click()
    page.get_by_role("button", name="Add filter for this column").click()
    expect(panel).to_be_visible()
    panel.get_by_label("even").check()
    table.locator("thead").get_by_role("checkbox").check()
    page.get_by_role("button", name="Delete selected rows").click()
    page.get_by_role("button", name="OK").click()
    expect(table.locator("tbody tr")).to_have_count(2)
    expect(page.locator(".leaflet-marker-icon")).to_have_count(2)
    expect(table.get_by_text("Point 1")).to_be_visible()
    expect(table.get_by_text("Point 3")).to_be_visible()
    expect(table.get_by_text("Point 2")).to_be_hidden()
    expect(table.get_by_text("Point 4")).to_be_hidden()
