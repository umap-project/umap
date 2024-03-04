import json
from pathlib import Path


def test_ids_generation(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a line button on a new map.
    create_polyline = page.locator(".leaflet-control-toolbar ").get_by_title(
        "Draw a polyline"
    )
    create_polyline.click()

    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})

    # Click on the Draw a polygon button on a new map.
    create_polygon = page.locator(".leaflet-control-toolbar ").get_by_title(
        "Draw a polygon"
    )
    create_polygon.click()

    map = page.locator("#map")
    map.click(position={"x": 300, "y": 300})
    map.click(position={"x": 300, "y": 400})
    map.click(position={"x": 350, "y": 450})
    # Click again to finish
    map.click(position={"x": 350, "y": 450})

    download_panel = page.get_by_title("Share and download")
    download_panel.click()

    button = page.get_by_role("button", name="geojson")

    with page.expect_download() as download_info:
        button.click()

    download = download_info.value

    path = Path("/tmp/") / download.suggested_filename
    download.save_as(path)
    downloaded = json.loads(path.read_text())

    assert "features" in downloaded
    features = downloaded["features"]
    assert len(features) == 2
    assert "id" in features[0]
    assert "id" in features[1]
