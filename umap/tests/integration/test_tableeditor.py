import json
import re
from pathlib import Path

from umap.models import DataLayer


def test_table_editor(live_server, openmap, datalayer, page):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("link", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit properties in a table").click()
    page.once("dialog", lambda dialog: dialog.accept(prompt_text="newprop"))
    page.get_by_text("Add a new property").click()
    page.locator('input[name="newprop"]').fill("newvalue")
    page.once("dialog", lambda dialog: dialog.accept())
    page.hover(".umap-table-editor .tcell")
    page.get_by_title("Delete this property on all").first.click()
    with page.expect_response(re.compile(r".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save").click()
    saved = DataLayer.objects.last()
    data = json.loads(Path(saved.geojson.path).read_text())
    assert data["features"][0]["properties"]["newprop"] == "newvalue"
    assert "name" not in data["features"][0]["properties"]
