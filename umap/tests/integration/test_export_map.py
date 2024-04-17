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
                "name": "test",
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
                "name": "test",
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
                            "name": "test",
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
                            "name": "test",
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
test,52.57635,-0.274658,Some description
test,53.725145179688646,2.9700064980570517,"""
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
        == """<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" creator="togpx"><metadata/><wpt lat="52.57635" lon="-0.274658"><name>test</name><desc>name=test
description=Some description</desc></wpt><trk><name>name poly</name><desc>name=name poly</desc><trkseg><trkpt lat="53.585984" lon="11.25"/><trkpt lat="52.975108" lon="10.151367"/><trkpt lat="52.167194" lon="12.689209"/><trkpt lat="53.199452" lon="14.084473"/><trkpt lat="53.618579" lon="12.634277"/><trkpt lat="53.585984" lon="11.25"/><trkpt lat="53.585984" lon="11.25"/></trkseg></trk><trk><name>test</name><desc>name=test</desc><trkseg><trkpt lat="54.476422" lon="-0.571289"/><trkpt lat="54.610255" lon="0.439453"/><trkpt lat="53.448807" lon="1.724854"/><trkpt lat="53.988395" lon="4.163818"/><trkpt lat="53.533778" lon="5.306396"/><trkpt lat="53.709714" lon="6.591797"/><trkpt lat="53.350551" lon="7.042236"/></trkseg></trk></gpx>"""
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
        == """<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>name poly</name><ExtendedData><Data name="name"><value>name poly</value></Data></ExtendedData><Polygon><outerBoundaryIs><LinearRing><coordinates>11.25,53.585984 10.151367,52.975108 12.689209,52.167194 14.084473,53.199452 12.634277,53.618579 11.25,53.585984 11.25,53.585984</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark><Placemark><name>test</name><description>Some description</description><ExtendedData><Data name="_umap_options"><value>[object Object]</value></Data><Data name="name"><value>test</value></Data><Data name="description"><value>Some description</value></Data></ExtendedData><Point><coordinates>-0.274658,52.57635</coordinates></Point></Placemark><Placemark><name>test</name><ExtendedData><Data name="_umap_options"><value>[object Object]</value></Data><Data name="name"><value>test</value></Data></ExtendedData><LineString><coordinates>-0.571289,54.476422 0.439453,54.610255 1.724854,53.448807 4.163818,53.988395 5.306396,53.533778 6.591797,53.709714 7.042236,53.350551</coordinates></LineString></Placemark></Document></kml>"""
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
                    "name": "test",
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
                    "name": "test",
                },
                "type": "Feature",
            },
        ],
        "type": "FeatureCollection",
    }
