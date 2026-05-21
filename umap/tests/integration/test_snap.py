import pytest
from playwright.sync_api import expect

from .helpers import save_and_get_json

pytestmark = pytest.mark.django_db


def draw_marker(page, x, y):
    page.locator(".umap-edit-bar ").get_by_title("Draw a marker").click()
    page.locator("#map").click(position={"x": x, "y": y})


def test_marker_snaps_to_existing_feature(page, live_server, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    # A large snapping distance means the whole viewport snaps to the only
    # existing point, so we don't have to reason about pixel coordinates.
    page.goto(f"{live_server.url}/en/map/new/?snapDistance=1000")
    markers = page.locator(".leaflet-marker-pane > div")

    # First marker has nothing to snap to: it lands where clicked.
    draw_marker(page, 200, 200)
    expect(markers).to_have_count(1)

    # Second marker, placed elsewhere, should snap onto the first one.
    draw_marker(page, 350, 350)
    expect(markers).to_have_count(2)

    data = save_and_get_json(page)
    coordinates = [f["geometry"]["coordinates"] for f in data["features"]]
    assert len(coordinates) == 2
    assert coordinates[0] == coordinates[1]


def test_marker_does_not_snap_when_disabled(page, live_server, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/?snapDistance=0")
    markers = page.locator(".leaflet-marker-pane > div")

    draw_marker(page, 200, 200)
    expect(markers).to_have_count(1)

    draw_marker(page, 350, 350)
    expect(markers).to_have_count(2)

    data = save_and_get_json(page)
    coordinates = [f["geometry"]["coordinates"] for f in data["features"]]
    assert len(coordinates) == 2
    assert coordinates[0] != coordinates[1]
