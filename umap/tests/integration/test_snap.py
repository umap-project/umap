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


def test_line_vertex_snaps_to_existing_feature_while_drawing(
    page, live_server, tilelayer, settings
):
    settings.UMAP_ALLOW_ANONYMOUS = True
    # Moderate distance: a vertex clicked close to the marker snaps onto it,
    # while one clicked far away keeps its position.
    page.goto(f"{live_server.url}/en/map/new/?snapDistance=30")

    draw_marker(page, 200, 200)
    page.locator(".umap-edit-bar ").get_by_title("Draw a polyline").click()
    map = page.locator("#map")
    map.click(position={"x": 205, "y": 205})  # within 30px of the marker -> snaps
    map.click(position={"x": 100, "y": 100})  # far away -> not snapped
    map.click(position={"x": 100, "y": 100})  # click last point again to finish

    data = save_and_get_json(page)
    features = {
        f["geometry"]["type"]: f["geometry"]["coordinates"] for f in data["features"]
    }
    assert features["LineString"][0] == features["Point"]
    assert features["LineString"][1] != features["Point"]


def test_snap_indicator_shows_before_first_vertex(
    page, live_server, tilelayer, settings
):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/?snapDistance=30")
    indicator = page.locator(".umap-snap-indicator")

    draw_marker(page, 200, 200)
    page.locator(".umap-edit-bar ").get_by_title("Draw a polyline").click()
    map = page.locator("#map")

    # No vertex placed yet: hovering near the marker should already show the
    # snap indicator, so the first point gets the same feedback as later ones.
    map.hover(position={"x": 205, "y": 205})
    expect(indicator).to_be_visible()
    # Moving away from any feature hides it.
    map.hover(position={"x": 360, "y": 360})
    expect(indicator).to_be_hidden()


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
