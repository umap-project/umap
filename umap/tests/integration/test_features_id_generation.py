import json
import re
from pathlib import Path

from umap.models import DataLayer


def test_ids_generation(page, live_server, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a line button on a new map.
    create_polyline = page.locator(".umap-edit-bar ").get_by_title("Draw a polyline")
    create_polyline.click()

    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})

    # Click on the Draw a polygon button on a new map.
    create_polygon = page.locator(".umap-edit-bar ").get_by_title("Draw a polygon")
    create_polygon.click()

    map = page.locator("#map")
    map.click(position={"x": 300, "y": 300})
    map.click(position={"x": 300, "y": 400})
    map.click(position={"x": 350, "y": 450})
    # Click again to finish
    map.click(position={"x": 350, "y": 450})

    with page.expect_response(re.compile(r".*/datalayer/create/.*")):
        page.get_by_role("button", name="Save draft", exact=True).click()

    datalayer = DataLayer.objects.last()
    data = json.loads(Path(datalayer.geojson.path).read_text())

    assert "features" in data
    features = data["features"]
    assert len(features) == 2
    assert "id" in features[0]
    assert "id" in features[1]
