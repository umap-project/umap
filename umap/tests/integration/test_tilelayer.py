import re

import pytest
from playwright.sync_api import expect

from umap.models import TileLayer

from ..base import TileLayerFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def tilelayers():
    # Create one more TileLayer than what we display in the switcher (11 vs 10)
    TileLayerFactory(
        rank=1,
        name="OpenStreetMap",
        url_template="https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    )
    TileLayerFactory(
        rank=2,
        name="Forte",
        url_template="https://{s}.forte.tiles.quaidorsay.fr/fr{r}/{z}/{x}/{y}.png",
    )
    TileLayerFactory(
        rank=3,
        name="Positron",
        url_template="https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png",
    )
    TileLayerFactory(
        rank=4,
        name="Humanitarian",
        url_template="//{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    )
    TileLayerFactory(
        rank=5,
        name="Dark Matter",
        url_template="https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
    )
    TileLayerFactory(
        rank=6,
        name="OSM OpenCycleMap",
        url_template="https://{s}.tile.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=e6b144cfc47a48fd928dad578eb026a6",
    )
    TileLayerFactory(
        rank=7,
        name="CyclOSM",
        url_template="//{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
    )
    TileLayerFactory(
        rank=8,
        name="Piano",
        url_template="https://{s}.piano.tiles.quaidorsay.fr/fr{r}/{z}/{x}/{y}.png",
    )
    TileLayerFactory(
        rank=9,
        name="IGN Image aérienne (France)",
        url_template="https://wxs.ign.fr/pratique/wmts/?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image%2Fjpeg",
    )
    TileLayerFactory(
        rank=10,
        name="OSM OpenRiverboatMap",
        url_template="//{s}.tile.openstreetmap.fr/openriverboatmap/{z}/{x}/{y}.png",
    )
    TileLayerFactory(
        rank=11,
        name="OSM OpenTopoMap",
        url_template="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    )


def test_map_should_display_first_tilelayer_by_default(
    map, live_server, tilelayers, page
):
    page.goto(f"{live_server.url}/map/new")
    tiles = page.locator(".leaflet-tile-pane img")
    expect(tiles.first).to_have_attribute(
        "src", re.compile(r"https://tile.openstreetmap.org/\d+/\d+/\d+.png")
    )


def test_map_should_display_selected_tilelayer(map, live_server, tilelayers, page):
    piano = TileLayer.objects.get(name="Piano")
    url_pattern = re.compile(
        r"https://[abc]{1}.piano.tiles.quaidorsay.fr/fr/\d+/\d+/\d+.png"
    )
    map.settings["properties"]["tilelayer"]["url_template"] = piano.url_template
    map.settings["properties"]["tilelayersControl"] = True
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    tiles = page.locator(".leaflet-tile-pane img")
    expect(tiles.first).to_have_attribute("src", url_pattern)
    iconTiles = page.locator(".leaflet-iconLayers .leaflet-iconLayers-layer")
    # The second of the list should be the current
    expect(iconTiles.nth(1)).to_have_css("background-image", url_pattern)


def test_map_should_display_custom_tilelayer(map, live_server, tilelayers, page):
    # Add one not on the list
    url_pattern = re.compile(
        r"https://[abc]{1}.basemaps.cartocdn.com/rastertiles/voyager/\d+/\d+/\d+.png"
    )
    map.settings["properties"]["tilelayer"]["url_template"] = (
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
    )
    map.settings["properties"]["tilelayersControl"] = True
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    tiles = page.locator(".leaflet-tile-pane img")
    expect(tiles.first).to_have_attribute("src", url_pattern)
    iconTiles = page.locator(".leaflet-iconLayers .leaflet-iconLayers-layer")
    # The second of the list should be the current
    expect(iconTiles.nth(1)).to_have_css("background-image", url_pattern)


def test_can_have_smart_text_in_attribution(tilelayer, map, live_server, page):
    map.settings["properties"]["tilelayer"]["attribution"] = (
        "&copy; [[http://www.openstreetmap.org/copyright|OpenStreetMap]] contributors"
    )
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.get_by_text("© OpenStreetMap contributors")).to_be_visible()
    expect(page.get_by_role("link", name="OpenStreetMap")).to_be_visible()


def test_map_should_display_a_more_button(map, live_server, tilelayers, page):
    map.settings["properties"]["tilelayersControl"] = True
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    page.locator(".leaflet-iconLayers").hover()
    page.get_by_role("button", name="+").click()
    panel = page.locator(".panel.left.on")
    expect(panel).to_be_visible()
    expect(panel.get_by_text("Forte")).to_be_visible()
    panel.get_by_text("Forte").click()
    tiles = page.locator(".leaflet-tile-pane img")
    url_pattern = re.compile(
        r"https://[abc]{1}.forte.tiles.quaidorsay.fr/fr/\d+/\d+/\d+.png"
    )
    expect(tiles.first).to_have_attribute("src", url_pattern)
