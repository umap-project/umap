import json
from pathlib import Path

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.django_db


def test_umap_export(map, live_server, datalayer, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}?share")
    button = page.locator("a").filter(has_text="Download data")
    expect(button).to_be_visible()
    with page.expect_download() as download_info:
        button.click()
    download = download_info.value
    assert download.suggested_filename == "test_map.umap"
    path = Path("/tmp/") / download.suggested_filename
    download.save_as(path)
    downloaded = json.loads(path.read_text())
    del downloaded["uri"]  # Port changes at each run
    assert downloaded == {
        "geometry": {
            "coordinates": [13.447265624999998, 48.94415123418794],
            "type": "Point",
        },
        "layers": [
            {
                "_umap_options": {
                    "browsable": True,
                    "displayOnLoad": True,
                    "editMode": "disabled",
                    "inCaption": True,
                    "name": "test datalayer",
                },
                "features": [
                    {
                        "geometry": {
                            "coordinates": [13.688965, 48.552978],
                            "type": "Point",
                        },
                        "properties": {
                            "_umap_options": {"color": "DarkCyan", "iconClass": "Ball"},
                            "description": "Da place anonymous " "again 755",
                            "name": "Here",
                        },
                        "type": "Feature",
                    }
                ],
                "type": "FeatureCollection",
            }
        ],
        "properties": {
            "captionBar": False,
            "captionMenus": True,
            "datalayersControl": True,
            "description": "Which is just the Danube, at the end",
            "displayPopupFooter": False,
            "easing": False,
            "embedControl": True,
            "fullscreenControl": True,
            "licence": "",
            "limitBounds": {},
            "miniMap": False,
            "moreControl": True,
            "name": "test map",
            "overlay": None,
            "permanentCreditBackground": True,
            "scaleControl": True,
            "scrollWheelZoom": True,
            "searchControl": True,
            "slideshow": {},
            "tilelayer": {
                "attribution": "© OSM Contributors",
                "maxZoom": 18,
                "minZoom": 0,
                "url_template": "http://{s}.osm.fr/{z}/{x}/{y}.png",
            },
            "tilelayersControl": True,
            "zoom": 7,
            "zoomControl": True,
        },
        "type": "umap",
    }


def test_csv_export(map, live_server, datalayer, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}?share")
    button = page.locator("a").filter(has_text="Download data")
    expect(button).to_be_visible()
    page.locator('select[name="format"]').select_option("csv")
    with page.expect_download() as download_info:
        button.click()
    download = download_info.value
    assert download.suggested_filename == "test_map.csv"
    path = Path("/tmp/") / download.suggested_filename
    download.save_as(path)
    assert (
        path.read_text()
        == """name,description,Latitude,Longitude
Here,Da place anonymous again 755,48.55297816440071,13.68896484375"""
    )
