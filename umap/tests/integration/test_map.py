import json
import re
from pathlib import Path

import pytest
from playwright.sync_api import expect

from umap.models import Map

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


def test_default_view_latest_without_datalayer_should_use_default_center(
    map, live_server, datalayer, page
):
    datalayer.settings["displayOnLoad"] = False
    datalayer.save()
    map.settings["properties"]["defaultView"] = "latest"
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    # Hash is defined, so map is initialized
    expect(page).to_have_url(re.compile(r".*#7/48\..+/13\..+"))
    layers = page.locator(".umap-browse-datalayers li")
    expect(layers).to_have_count(1)


def test_default_view_latest_with_marker(map, live_server, datalayer, page):
    map.settings["properties"]["defaultView"] = "latest"
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    # Hash is defined, so map is initialized
    expect(page).to_have_url(re.compile(r".*#7/48\..+/14\..+"))
    layers = page.locator(".umap-browse-datalayers li")
    expect(layers).to_have_count(1)


def test_default_view_latest_with_line(map, live_server, page):
    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "a line"},
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [2.12, 49.57],
                        [3.19, 48.77],
                        [2.51, 47.55],
                        [1.08, 49.02],
                    ],
                },
            }
        ],
    }
    DataLayerFactory(map=map, data=data)
    map.settings["properties"]["defaultView"] = "latest"
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page).to_have_url(re.compile(r".*#8/48\..+/2\..+"))
    layers = page.locator(".umap-browse-datalayers li")
    expect(layers).to_have_count(1)


def test_default_view_latest_with_polygon(map, live_server, page):
    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"name": "a polygon"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [2.12, 49.57],
                            [1.08, 49.02],
                            [2.51, 47.55],
                            [3.19, 48.77],
                            [2.12, 49.57],
                        ]
                    ],
                },
            }
        ],
    }
    DataLayerFactory(map=map, data=data)
    map.settings["properties"]["defaultView"] = "latest"
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page).to_have_url(re.compile(r".*#8/48\..+/2\..+"))
    layers = page.locator(".umap-browse-datalayers li")
    expect(layers).to_have_count(1)


def test_remote_layer_should_not_be_used_as_datalayer_for_created_features(
    map, live_server, datalayer, page
):
    # Faster than doing a login
    map.edit_status = Map.ANONYMOUS
    map.save()
    datalayer.settings["remoteData"] = {
        "url": "https://overpass-api.de/api/interpreter?data=[out:xml];node[harbour=yes]({south},{west},{north},{east});out body;",
        "format": "osm",
        "from": "10",
    }
    datalayer.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    toggle = page.get_by_role("button", name="See data layers")
    expect(toggle).to_be_visible()
    toggle.click()
    layers = page.locator(".umap-browse-datalayers li")
    expect(layers).to_have_count(1)
    map_el = page.locator("#map")
    add_marker = page.get_by_title("Draw a marker")
    expect(add_marker).to_be_visible()
    marker = page.locator(".leaflet-marker-icon")
    expect(marker).to_have_count(0)
    add_marker.click()
    map_el.click(position={"x": 100, "y": 100})
    expect(marker).to_have_count(1)
    # A new datalayer has been created to host this created feature
    # given the remote one cannot accept new features
    expect(layers).to_have_count(2)


def test_can_hide_datalayer_from_caption(map, live_server, datalayer, page):
    # Faster than doing a login
    map.edit_status = Map.ANONYMOUS
    map.save()
    # Add another DataLayer
    other = DataLayerFactory(map=map, name="Hidden", settings={"inCaption": False})
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    toggle = page.get_by_text("About").first
    expect(toggle).to_be_visible()
    toggle.click()
    layers = page.locator(".umap-caption .datalayer-legend")
    expect(layers).to_have_count(1)
    found = page.locator("#umap-ui-container").get_by_text(datalayer.name)
    expect(found).to_be_visible()
    hidden = page.locator("#umap-ui-container").get_by_text(other.name)
    expect(hidden).to_be_hidden()


def test_basic_choropleth_map(map, live_server, page):
    path = Path(__file__).parent.parent / "fixtures/choropleth_region_chomage.geojson"
    data = json.loads(path.read_text())
    DataLayerFactory(data=data, map=map)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    # Hauts-de-France
    paths = page.locator("path[fill='#08519c']")
    expect(paths).to_have_count(1)
    # Occitanie
    paths = page.locator("path[fill='#3182bd']")
    expect(paths).to_have_count(1)
    # Grand-Est, PACA
    paths = page.locator("path[fill='#6baed6']")
    expect(paths).to_have_count(2)
    # Bourgogne-Franche-Comté, Centre-Val-de-Loire, IdF, Normandie, Corse, Nouvelle-Aquitaine
    paths = page.locator("path[fill='#bdd7e7']")
    expect(paths).to_have_count(6)
    # Bretagne, Pays de la Loire, AURA
    paths = page.locator("path[fill='#eff3ff']")
    expect(paths).to_have_count(3)
