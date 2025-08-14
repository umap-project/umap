import json
from pathlib import Path

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
                "name": "name poly",
            },
            "id": "gyNzM",
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [11.25, 53.585984],
                        [10.151367, 52.975108],
                        [12.689209, 52.167194],
                        [14.084473, 53.199452],
                        [12.634277, 53.618579],
                        [11.25, 53.585984],
                        [11.25, 53.585984],
                    ],
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {
                "_umap_options": {
                    "color": "OliveDrab",
                },
                "name": "test one",
                "description": "Some description",
            },
            "id": "QwNjg",
            "geometry": {
                "type": "Point",
                "coordinates": [-0.274658, 52.57635],
            },
        },
        {
            "type": "Feature",
            "properties": {
                "_umap_options": {
                    "fill": False,
                    "opacity": 0.6,
                },
                "name": "test two",
            },
            "id": "YwMTM",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [-0.571289, 54.476422],
                    [0.439453, 54.610255],
                    [1.724854, 53.448807],
                    [4.163818, 53.988395],
                    [5.306396, 53.533778],
                    [6.591797, 53.709714],
                    [7.042236, 53.350551],
                ],
            },
        },
    ],
}


@pytest.fixture
def bootstrap(map, live_server):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA)


def test_umap_export(map, live_server, bootstrap, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}?share")
    link = page.get_by_role("link", name="full backup")
    expect(link).to_be_visible()
    with page.expect_download() as download_info:
        link.click()
    download = download_info.value
    assert download.suggested_filename == "umap_backup_test-map.umap"
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
                    "name": "test datalayer",
                    "fields": [
                        {
                            "key": "name",
                            "type": "String",
                        },
                        {
                            "key": "description",
                            "type": "Text",
                        },
                    ],
                },
                "features": [
                    {
                        "geometry": {
                            "coordinates": [
                                [
                                    [11.25, 53.585984],
                                    [10.151367, 52.975108],
                                    [12.689209, 52.167194],
                                    [14.084473, 53.199452],
                                    [12.634277, 53.618579],
                                    [11.25, 53.585984],
                                    [11.25, 53.585984],
                                ]
                            ],
                            "type": "Polygon",
                        },
                        "id": "gyNzM",
                        "properties": {"name": "name poly"},
                        "type": "Feature",
                    },
                    {
                        "geometry": {
                            "coordinates": [-0.274658, 52.57635],
                            "type": "Point",
                        },
                        "id": "QwNjg",
                        "properties": {
                            "_umap_options": {"color": "OliveDrab"},
                            "name": "test one",
                            "description": "Some description",
                        },
                        "type": "Feature",
                    },
                    {
                        "geometry": {
                            "coordinates": [
                                [-0.571289, 54.476422],
                                [0.439453, 54.610255],
                                [1.724854, 53.448807],
                                [4.163818, 53.988395],
                                [5.306396, 53.533778],
                                [6.591797, 53.709714],
                                [7.042236, 53.350551],
                            ],
                            "type": "LineString",
                        },
                        "id": "YwMTM",
                        "properties": {
                            "_umap_options": {"fill": False, "opacity": 0.6},
                            "name": "test two",
                        },
                        "type": "Feature",
                    },
                ],
                "type": "FeatureCollection",
            }
        ],
        "properties": {
            "datalayersControl": True,
            "description": "Which is just the Danube, at the end",
            "displayPopupFooter": False,
            "licence": "",
            "miniMap": False,
            "moreControl": True,
            "name": "test map",
            "scaleControl": True,
            "tilelayer": {
                "attribution": "© OSM Contributors",
                "maxZoom": 18,
                "minZoom": 0,
                "url_template": "https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
            },
            "tilelayersControl": True,
            "zoom": 7,
            "zoomControl": True,
            "onLoadPanel": "databrowser",
        },
        "type": "umap",
    }


def test_csv_export(map, live_server, bootstrap, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}?share")
    button = page.get_by_role("button", name="csv")
    expect(button).to_be_visible()
    with page.expect_download() as download_info:
        button.click()
    download = download_info.value
    assert download.suggested_filename == "test_map.csv"
    path = Path("/tmp/") / download.suggested_filename
    download.save_as(path)
    assert (
        path.read_text()
        == """name,Latitude,Longitude,description
name poly,53.0072070131872,12.182431646910137,
test one,52.57635,-0.274658,Some description
test two,53.725145179688646,2.9700064980570517,"""
    )


def test_gpx_export(map, live_server, bootstrap, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}?share")
    button = page.get_by_role("button", name="gpx")
    expect(button).to_be_visible()
    with page.expect_download() as download_info:
        button.click()
    download = download_info.value
    # FIXME assert mimetype (find no way to access it throught PW)
    assert download.suggested_filename == "test_map.gpx"
    path = Path("/tmp/") / download.suggested_filename
    download.save_as(path)
    assert (
        path.read_text()
        == """<?xml version="1.0" encoding="UTF-8"?><gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="@dwayneparton/geojson-to-gpx"><wpt lat="52.57635" lon="-0.274658"><name>test one</name><desc>Some description</desc></wpt><trk><name>test two</name><trkseg><trkpt lat="54.476422" lon="-0.571289"/><trkpt lat="54.610255" lon="0.439453"/><trkpt lat="53.448807" lon="1.724854"/><trkpt lat="53.988395" lon="4.163818"/><trkpt lat="53.533778" lon="5.306396"/><trkpt lat="53.709714" lon="6.591797"/><trkpt lat="53.350551" lon="7.042236"/></trkseg></trk></gpx>"""
    )


def test_kml_export(map, live_server, bootstrap, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}?share")
    button = page.get_by_role("button", name="kml")
    expect(button).to_be_visible()
    with page.expect_download() as download_info:
        button.click()
    download = download_info.value
    assert download.suggested_filename == "test_map.kml"
    path = Path("/tmp/") / download.suggested_filename
    download.save_as(path)
    assert (
        path.read_text()
        == """<kml xmlns="http://www.opengis.net/kml/2.2"><Document>\n<Placemark id="gyNzM">\n<name>name poly</name><ExtendedData></ExtendedData>\n  <Polygon>\n<outerBoundaryIs>\n  <LinearRing><coordinates>11.25,53.585984\n10.151367,52.975108\n12.689209,52.167194\n14.084473,53.199452\n12.634277,53.618579\n11.25,53.585984\n11.25,53.585984</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>\n<Placemark id="QwNjg">\n<name>test one</name><description>Some description</description><ExtendedData>\n  <Data name="_umap_options"><value>{"color":"OliveDrab"}</value></Data></ExtendedData>\n  <Point><coordinates>-0.274658,52.57635</coordinates></Point></Placemark>\n<Placemark id="YwMTM">\n<name>test two</name><ExtendedData>\n  <Data name="_umap_options"><value>{"fill":false,"opacity":0.6}</value></Data></ExtendedData>\n  <LineString><coordinates>-0.571289,54.476422\n0.439453,54.610255\n1.724854,53.448807\n4.163818,53.988395\n5.306396,53.533778\n6.591797,53.709714\n7.042236,53.350551</coordinates></LineString></Placemark></Document></kml>"""
    )


def test_geojson_export(map, live_server, bootstrap, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}?share")
    button = page.get_by_role("button", name="geojson")
    expect(button).to_be_visible()
    with page.expect_download() as download_info:
        button.click()
    download = download_info.value
    assert download.suggested_filename == "test_map.geojson"
    path = Path("/tmp/") / download.suggested_filename
    download.save_as(path)
    assert json.loads(path.read_text()) == {
        "features": [
            {
                "geometry": {
                    "coordinates": [
                        [
                            [11.25, 53.585984],
                            [10.151367, 52.975108],
                            [12.689209, 52.167194],
                            [14.084473, 53.199452],
                            [12.634277, 53.618579],
                            [11.25, 53.585984],
                            [11.25, 53.585984],
                        ]
                    ],
                    "type": "Polygon",
                },
                "id": "gyNzM",
                "properties": {"name": "name poly"},
                "type": "Feature",
            },
            {
                "geometry": {"coordinates": [-0.274658, 52.57635], "type": "Point"},
                "id": "QwNjg",
                "properties": {
                    "_umap_options": {"color": "OliveDrab"},
                    "name": "test one",
                    "description": "Some description",
                },
                "type": "Feature",
            },
            {
                "geometry": {
                    "coordinates": [
                        [-0.571289, 54.476422],
                        [0.439453, 54.610255],
                        [1.724854, 53.448807],
                        [4.163818, 53.988395],
                        [5.306396, 53.533778],
                        [6.591797, 53.709714],
                        [7.042236, 53.350551],
                    ],
                    "type": "LineString",
                },
                "id": "YwMTM",
                "properties": {
                    "_umap_options": {"fill": False, "opacity": 0.6},
                    "name": "test two",
                },
                "type": "Feature",
            },
        ],
        "type": "FeatureCollection",
    }


def test_export_should_respect_filters(map, live_server, bootstrap, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    page.locator("summary").filter(has_text="Filters").locator("i").click()
    page.get_by_role("textbox", name="Search map features…").fill("test")
    page.wait_for_timeout(300)  # Wait for debounce
    page.get_by_role("button", name="Share and download").click()
    button = page.get_by_role("button", name="geojson")
    expect(button).to_be_visible()
    with page.expect_download() as download_info:
        button.click()
    download = download_info.value
    assert download.suggested_filename == "test_map.geojson"
    path = Path("/tmp/") / download.suggested_filename
    download.save_as(path)
    assert json.loads(path.read_text()) == {
        "features": [
            {
                "geometry": {"coordinates": [-0.274658, 52.57635], "type": "Point"},
                "id": "QwNjg",
                "properties": {
                    "_umap_options": {"color": "OliveDrab"},
                    "name": "test one",
                    "description": "Some description",
                },
                "type": "Feature",
            },
            {
                "geometry": {
                    "coordinates": [
                        [-0.571289, 54.476422],
                        [0.439453, 54.610255],
                        [1.724854, 53.448807],
                        [4.163818, 53.988395],
                        [5.306396, 53.533778],
                        [6.591797, 53.709714],
                        [7.042236, 53.350551],
                    ],
                    "type": "LineString",
                },
                "id": "YwMTM",
                "properties": {
                    "_umap_options": {"fill": False, "opacity": 0.6},
                    "name": "test two",
                },
                "type": "Feature",
            },
        ],
        "type": "FeatureCollection",
    }


def test_png_export(map, live_server, bootstrap, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}?share#6/53.406/6.757")
    page.get_by_role("button", name="png").click()
    with page.expect_download() as download_info:
        page.get_by_role("button", name="Download", exact=True).click()
    download = download_info.value
    assert download.suggested_filename == "test_map.png"
    path = Path("/tmp/") / download.suggested_filename
    download.save_as(path)
    # Something has been saved…
    assert path.read_bytes()
