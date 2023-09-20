import pytest
from playwright.sync_api import expect

from umap.models import Map

pytestmark = pytest.mark.django_db


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
    toggle = page.get_by_title("See data layers")
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
