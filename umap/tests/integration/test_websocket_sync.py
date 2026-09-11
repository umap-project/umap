import re

import pytest
import redis
from django.conf import settings
from playwright.sync_api import expect

from umap.models import DataLayer, Map

from ..base import DataLayerFactory

DATALAYER_UPDATE = re.compile(r".*/datalayer/update/.*")

# The data browser panel overlays the map on its left, so map clicks are shifted
# by its width to stay on the canvas.
PANEL = 400

pytestmark = pytest.mark.django_db


def setup_function():
    # Sync client to prevent headache with pytest / pytest-asyncio and async
    client = redis.from_url(settings.REDIS_URL)
    # Make sure there are no dead peers in the Redis hash, otherwise asking for
    # operations from another peer may never be answered
    # FIXME this should not happen in an ideal world
    assert client.connection_pool.connection_kwargs["db"] == 15
    client.flushdb()


def drag_on_map(page, source, target):
    """Drag on the canvas, where there is no element to hand to drag_to."""
    page.mouse.move(*source)
    page.mouse.down()
    page.mouse.move(*target, steps=10)
    page.mouse.up()


@pytest.fixture
def syncmap(map):
    map.settings["properties"]["syncEnabled"] = True
    map.edit_status = Map.ANONYMOUS
    map.save()
    return map


@pytest.mark.xdist_group(name="websockets")
@pytest.mark.screenshot
def test_websocket_connection_can_sync_markers(
    syncmap, new_page, asgi_live_server, tilelayer, wait_for_loaded, assert_screenshot
):
    DataLayerFactory(map=syncmap, data={})

    # Create two tabs
    peerA = new_page("Page A")
    response = peerA.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    assert response.status == 200
    wait_for_loaded(peerA)
    peerB = new_page("Page B")
    peerB.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerB)

    a_markers = peerA.locator(".umap-browser .feature.marker")
    b_markers = peerB.locator(".umap-browser .feature.marker")
    expect(a_markers).to_have_count(0)
    expect(b_markers).to_have_count(0)

    # Add a marker from peer A
    a_create_marker = peerA.get_by_title("Draw a marker")
    expect(a_create_marker).to_be_visible()
    a_create_marker.click()

    a_map_el = peerA.locator("#map")
    a_map_el.click(position={"x": PANEL + 220, "y": 220})
    peerA.wait_for_timeout(300)  # Time for the panel animation to finish
    expect(a_markers).to_have_count(1)
    expect(b_markers).to_have_count(1)

    # Peer B should not be in state dirty
    expect(peerB.get_by_role("button", name="View", exact=True)).to_be_visible()
    expect(peerB.get_by_role("button", name="Cancel edits")).to_be_hidden()
    peerA.locator("body").type("Synced name")
    peerA.locator("body").press("Escape")

    # The browser only proves the feature reached the model: check both canvases.
    assert_screenshot(peerA.locator("#map"), "a-one-marker", ui=False)
    assert_screenshot(peerB.locator("#map"), "b-one-marker", ui=False)

    expect(b_markers).to_contain_text("Synced name")
    b_markers.first.get_by_title("Edit this feature").click()
    expect(peerB.locator('input[name="name"]')).to_have_value("Synced name")
    peerB.locator("body").press("Escape")

    # Add a second marker from peer B
    b_create_marker = peerB.get_by_title("Draw a marker")
    expect(b_create_marker).to_be_visible()
    b_create_marker.click()

    b_map_el = peerB.locator("#map")
    # Far enough from the first marker: Snap would otherwise stack them, and the
    # drag below would then move both at once.
    b_map_el.click(position={"x": PANEL + 320, "y": 320})
    expect(a_markers).to_have_count(2)
    expect(b_markers).to_have_count(2)
    peerB.locator("body").press("Escape")
    assert_screenshot(peerA.locator("#map"), "a-two-markers", ui=False)
    assert_screenshot(peerB.locator("#map"), "b-two-markers", ui=False)

    # Delete a marker from peer A and check it's been deleted on peer B
    a_markers.first.get_by_title("Delete this feature").click()
    expect(a_markers).to_have_count(1)
    expect(b_markers).to_have_count(1)
    assert_screenshot(peerA.locator("#map"), "a-marker-deleted", ui=False)
    assert_screenshot(peerB.locator("#map"), "b-marker-deleted", ui=False)

    # Drag the remaining marker on peer B and check that it moved on peer A
    drag_on_map(peerB, (PANEL + 320, 320), (PANEL + 350, 350))

    assert_screenshot(peerA.locator("#map"), "a-marker-moved", ui=False)
    assert_screenshot(peerB.locator("#map"), "b-marker-moved", ui=False)


@pytest.mark.xdist_group(name="websockets")
@pytest.mark.screenshot
def test_websocket_connection_can_sync_polygons(
    syncmap, new_page, asgi_live_server, tilelayer, wait_for_loaded, assert_screenshot
):
    DataLayerFactory(map=syncmap, data={})

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerA)
    peerB = new_page("Page B")
    peerB.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerB)

    a_map_el = peerA.locator("#map")
    b_map_el = peerB.locator("#map")

    # Click on the Draw a polygon button on a new map.
    create_line = peerA.locator(".umap-edit-bar ").get_by_title("Draw a polygon")
    create_line.click()

    a_polygons = peerA.locator(".umap-browser .feature.polygon")
    b_polygons = peerB.locator(".umap-browser .feature.polygon")
    expect(a_polygons).to_have_count(0)
    expect(b_polygons).to_have_count(0)

    # Click on the map, it will create a polygon.
    a_map_el.click(position={"x": PANEL + 200, "y": 200})
    a_map_el.click(position={"x": PANEL + 100, "y": 200})
    a_map_el.click(position={"x": PANEL + 100, "y": 100})
    a_map_el.click(position={"x": PANEL + 100, "y": 100})

    # It is created on peerA, and should be on peerB
    expect(a_polygons).to_have_count(1)
    expect(b_polygons).to_have_count(1)

    # Escaping the edition should not duplicate
    peerA.keyboard.press("Escape")
    expect(a_polygons).to_have_count(1)
    expect(b_polygons).to_have_count(1)

    assert_screenshot(peerA.locator("#map"), "a-polygon-created", ui=False)
    assert_screenshot(peerB.locator("#map"), "b-polygon-created", ui=False)

    # Change the geometry by moving a vertex on peer B. Modify is paused while
    # something is selected, so make sure nothing is.
    peerB.keyboard.press("Escape")
    drag_on_map(peerB, (PANEL + 100, 100), (PANEL + 233, 126))
    peerB.keyboard.press("Escape")

    assert_screenshot(peerA.locator("#map"), "a-vertex-moved", ui=False)
    assert_screenshot(peerB.locator("#map"), "b-vertex-moved", ui=False)

    # Move the polygon on peer B and check it moved also on peer A
    b_map_el.click(position={"x": PANEL + 140, "y": 170})
    drag_on_map(peerB, (PANEL + 140, 170), (PANEL + 300, 300))
    peerB.keyboard.press("Escape")

    assert_screenshot(peerA.locator("#map"), "a-polygon-moved", ui=False)
    assert_screenshot(peerB.locator("#map"), "b-polygon-moved", ui=False)

    # Delete a polygon from peer A and check it's been deleted on peer B
    a_polygons.first.get_by_title("Delete this feature").click()
    expect(a_polygons).to_have_count(0)
    expect(b_polygons).to_have_count(0)


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_map_properties(
    syncmap, new_page, asgi_live_server, tilelayer, wait_for_loaded
):
    DataLayerFactory(map=syncmap, data={})

    # Create two tabs
    peerA = new_page()
    peerA.goto(f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit")
    wait_for_loaded(peerA)
    peerB = new_page()
    peerB.goto(f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit")
    wait_for_loaded(peerB)

    # Name change is synced
    peerA.get_by_role("button", name="Edit map name and caption").click()
    peerA.locator('input[name="name"]').click()
    peerA.locator('input[name="name"]').fill("it syncs!")

    expect(peerB.locator(".map-name").last).to_have_text("it syncs!")

    # Zoom control is synced
    peerB.get_by_role("button", name="Map advanced properties").click()
    peerB.locator("summary").filter(has_text="User interface options").click()
    switch = peerB.locator("div.formbox").filter(
        has_text=re.compile("Display the zoom control")
    )
    expect(switch).to_be_visible()
    switch.get_by_text("Never").click()

    expect(peerA.locator(".umap-control-zoom")).to_be_hidden()


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_datalayer_properties(
    syncmap, new_page, asgi_live_server, tilelayer, wait_for_loaded
):
    DataLayerFactory(map=syncmap, data={})

    # Create two tabs
    peerA = new_page()
    peerA.goto(f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit")
    wait_for_loaded(peerA)
    peerB = new_page()
    peerB.goto(f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit")
    wait_for_loaded(peerB)

    # Layer addition, name and type are synced
    peerA.get_by_role("button", name="Manage layers").click()
    peerA.get_by_role("button", name="Add a layer").click()
    peerA.locator('input[name="name"]').fill("synced layer!")
    peerA.locator('select[name="type"]').select_option("Choropleth")
    peerA.locator("body").press("Escape")

    peerB.get_by_role("button", name="Manage layers").click()
    peerB.locator(".panel.right").get_by_role(
        "button", name="Edit", exact=True
    ).first.click()
    expect(peerB.locator('input[name="name"]')).to_have_value("synced layer!")
    expect(peerB.locator('select[name="type"]')).to_have_value("Choropleth")


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_cloned_polygons(
    syncmap, new_page, asgi_live_server, tilelayer, wait_for_loaded
):
    DataLayerFactory(map=syncmap, data={})

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerA)
    peerB = new_page("Page B")
    peerB.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerB)

    a_map_el = peerA.locator("#map")
    b_map_el = peerB.locator("#map")

    # Click on the Draw a polygon button on a new map.
    create_line = peerA.locator(".umap-edit-bar ").get_by_title("Draw a polygon")
    create_line.click()

    a_polygons = peerA.locator(".umap-browser .feature.polygon")
    b_polygons = peerB.locator(".umap-browser .feature.polygon")
    expect(a_polygons).to_have_count(0)
    expect(b_polygons).to_have_count(0)

    # Click on the map, it will create a polygon.
    a_map_el.click(position={"x": PANEL + 200, "y": 200})
    a_map_el.click(position={"x": PANEL + 100, "y": 200})
    a_map_el.click(position={"x": PANEL + 100, "y": 100})
    a_map_el.click(position={"x": PANEL + 200, "y": 100})
    a_map_el.click(position={"x": PANEL + 200, "y": 100})

    # Escaping the edition syncs
    peerA.keyboard.press("Escape")
    expect(a_polygons).to_have_count(1)
    expect(b_polygons).to_have_count(1)

    # Save from peer A
    peerA.get_by_role("button", name="Save").click()

    # Clone on peer B and save
    b_map_el.click(position={"x": PANEL + 150, "y": 150}, button="right", delay=200)
    peerB.get_by_role("button", name="Clone this feature").click()

    expect(b_polygons).to_have_count(2)

    # The clone is the edited feature, hence the one Translate will move.
    drag_on_map(peerB, (PANEL + 150, 150), (PANEL + 350, 350))
    peerB.locator("summary").filter(has_text="Shape properties").click()
    peerB.locator(".umap-field-color button.define").first.click()
    peerB.get_by_title("Orchid", exact=True).first.click()
    peerB.locator("#map").press("Escape")
    peerB.get_by_role("button", name="Save").click()

    expect(b_polygons).to_have_count(2)
    expect(a_polygons).to_have_count(2)


@pytest.mark.xdist_group(name="websockets")
def test_websocket_connection_can_sync_late_joining_peer(
    syncmap, new_page, asgi_live_server, tilelayer, wait_for_loaded
):
    DataLayerFactory(map=syncmap, data={})

    # Create first peer (A) and have it join immediately
    peerA = new_page("Page A")
    peerA.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerA)

    # Add a marker from peer A
    a_create_marker = peerA.get_by_title("Draw a marker")
    expect(a_create_marker).to_be_visible()
    a_create_marker.click()

    a_map_el = peerA.locator("#map")
    a_map_el.click(position={"x": PANEL + 220, "y": 220})
    peerA.wait_for_timeout(300)  # Time for the panel animation to finish
    peerA.locator("body").type("First marker")
    peerA.locator("body").press("Escape")

    # Add a polygon from peer A
    create_polygon = peerA.locator(".umap-edit-bar ").get_by_title("Draw a polygon")
    create_polygon.click()

    a_map_el.click(position={"x": PANEL + 200, "y": 200})
    a_map_el.click(position={"x": PANEL + 100, "y": 200})
    a_map_el.click(position={"x": PANEL + 100, "y": 100})
    a_map_el.click(position={"x": PANEL + 200, "y": 100})
    a_map_el.click(position={"x": PANEL + 200, "y": 100})
    peerA.keyboard.press("Escape")

    # Now create peer B and have it join
    peerB = new_page("Page B")
    peerB.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerB)

    # Check if peer B has received all the updates
    b_markers = peerB.locator(".umap-browser .feature.marker")
    b_polygons = peerB.locator(".umap-browser .feature.polygon")

    expect(b_markers).to_have_count(1)
    expect(b_polygons).to_have_count(1)

    # Verify marker properties
    expect(b_markers).to_contain_text("First marker")
    b_markers.first.get_by_title("Edit this feature").click()
    expect(peerB.locator('input[name="name"]')).to_have_value("First marker")

    # Clean up: close edit mode
    peerB.locator("body").press("Escape")


@pytest.mark.xdist_group(name="websockets")
def test_should_sync_datalayers(
    syncmap, new_page, asgi_live_server, tilelayer, wait_for_loaded
):

    assert not DataLayer.objects.count()

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerA)
    peerB = new_page("Page B")
    peerB.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerB)

    a_markers = peerA.locator(".umap-browser .feature.marker")
    b_markers = peerB.locator(".umap-browser .feature.marker")

    # Create a new layer from peerA
    peerA.get_by_role("button", name="Manage layers").click()
    peerA.get_by_role("button", name="Add a layer").click()

    # Check layer has been sync to peerB
    expect(peerB.get_by_text("Layer 1")).to_be_visible()

    # Draw a marker in layer 1 from peerA
    peerA.get_by_role("button", name="Draw a marker (Ctrl+M)").click()
    peerA.locator("#map").click(position={"x": PANEL + 200, "y": 200})

    # Check marker is visible from peerB
    expect(b_markers).to_have_count(1)

    # Save layer to the server
    with peerA.expect_response(re.compile(".*/datalayer/create/.*")):
        peerA.get_by_role("button", name="Save").click()

    assert DataLayer.objects.count() == 1

    # Create another layer from peerA and draw a marker on it (without saving to server)
    peerA.get_by_role("button", name="Manage layers").click()
    peerA.get_by_role("button", name="Add a layer").click()
    peerA.get_by_role("button", name="Draw a marker (Ctrl+M)").click()
    peerA.locator("#map").click(position={"x": PANEL + 250, "y": 250})

    # Make sure this new marker is in Layer 2 for peerB
    expect(peerB.locator("summary").filter(has_text="Layer 2")).to_be_visible()
    expect(b_markers).to_have_count(2)

    # Now draw a marker from peerB
    peerB.get_by_role("button", name="Draw a marker (Ctrl+M)").click()
    peerB.locator("#map").click(position={"x": PANEL + 300, "y": 300})
    peerB.locator('input[name="name"]').fill("marker from peerB")

    # Save from peer B
    with peerB.expect_response(re.compile(".*/datalayer/create/.*")):
        peerB.get_by_role("button", name="Save").click()

    assert DataLayer.objects.count() == 2

    # Peer A should not be in dirty state
    expect(peerA.locator("body")).not_to_have_class(re.compile(".*umap-is-dirty.*"))

    # Check this new marker is visible from peerA
    expect(a_markers).to_have_count(3)

    assert DataLayer.objects.count() == 2


@pytest.mark.xdist_group(name="websockets")
def test_should_sync_datalayers_delete(
    syncmap, new_page, asgi_live_server, tilelayer, wait_for_loaded
):
    data1 = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "Point 1",
                },
                "geometry": {"type": "Point", "coordinates": [0.065918, 48.385442]},
            },
        ],
        "properties": {
            "name": "datalayer 1",
        },
    }
    data2 = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "name": "Point 2",
                },
                "geometry": {"type": "Point", "coordinates": [3.55957, 49.767074]},
            },
        ],
        "properties": {
            "name": "datalayer 2",
        },
    }
    layer1 = DataLayerFactory(map=syncmap, data=data1)
    layer2 = DataLayerFactory(map=syncmap, data=data2)

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerA)
    peerB = new_page("Page B")
    peerB.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerB)

    expect(peerA.locator(".panel").get_by_text("datalayer 1")).to_be_visible()
    expect(peerA.locator(".panel").get_by_text("datalayer 2")).to_be_visible()
    expect(peerB.locator(".panel").get_by_text("datalayer 1")).to_be_visible()
    expect(peerB.locator(".panel").get_by_text("datalayer 2")).to_be_visible()

    # Delete "datalayer 2" in peerA, from the browser
    peerA.locator(f'.umap-browser summary[data-id="{layer2.pk}"] .icon-delete').click()
    peerA.locator(".datalayer").get_by_role("button", name="Delete layer").first.click()
    expect(peerA.locator(".panel").get_by_text("datalayer 2")).to_be_hidden()
    expect(peerB.locator(".panel").get_by_text("datalayer 2")).to_be_hidden()

    # Save delete to the server
    with peerA.expect_response(re.compile(".*/datalayer/delete/.*")):
        peerA.get_by_role("button", name="Save").click()
    expect(peerA.locator(".panel").get_by_text("datalayer 2")).to_be_hidden()
    expect(peerB.locator(".panel").get_by_text("datalayer 2")).to_be_hidden()
    assert layer1


@pytest.mark.xdist_group(name="websockets")
def test_create_and_sync_map(
    new_page, asgi_live_server, tilelayer, login, user, wait_for_loaded
):
    # Create a syncable map with peerA
    peerA = login(user, prefix="Page A")
    peerA.goto(f"{asgi_live_server.url}/en/map/new/")
    wait_for_loaded(peerA)
    peerA.get_by_role("button", name="Map advanced properties").click()
    expect(peerA.get_by_text("Real-time collaboration", exact=True)).to_be_hidden()
    with peerA.expect_response(re.compile("./map/create/.*")):
        peerA.get_by_role("button", name="Save Draft").click()
    peerA.get_by_role("button", name="Map advanced properties").click()
    expect(peerA.get_by_text("Real-time collaboration", exact=True)).to_be_visible()
    peerA.get_by_text("Real-time collaboration", exact=True).click()
    peerA.get_by_text("Enable real-time").click()
    peerA.get_by_role("button", name="Update permissions and editors").click()
    peerA.locator('select[name="share_status"]').select_option(str(Map.PUBLIC))
    with peerA.expect_response(re.compile("./update/settings/.*")):
        peerA.get_by_role("button", name="Save").click()
    expect(peerA.get_by_role("button", name="Cancel edits")).to_be_hidden()
    # Quit edit mode
    peerA.get_by_role("button", name="View", exact=True).click()
    expect(peerA.locator("body")).not_to_have_class(re.compile(".*umap-edit-enabled.*"))

    # Open map and go to edit mode with peer B
    peerB = new_page("Page B")
    peerB.goto(peerA.url)
    wait_for_loaded(peerB)
    peerB.get_by_role("button", name="Edit", exact=True).click()

    # This map is created through the UI, so the browser has to be opened by hand.
    peerB.get_by_role("button", name="Open browser").click()
    # This test toggles edit mode several times, and each rebuild of the browser
    # collapses the layer, dropping the feature rows. The layer counter survives it.
    countA = peerA.locator(".umap-browser .datalayer-counter")
    countB = peerB.locator(".umap-browser .datalayer-counter")
    expect(countB).to_have_count(0)

    # Add a marker from peer A
    peerA.get_by_role("button", name="Edit", exact=True).click()
    peerA.wait_for_timeout(300)  # Time for the animation to finish
    peerA.get_by_role("button", name="Open browser").click()
    expect(countA).to_have_count(0)
    peerA.get_by_title("Draw a marker").click()
    peerA.locator("#map").click(position={"x": PANEL + 220, "y": 220})
    peerA.wait_for_timeout(300)  # Time for the panel animation to finish
    expect(countA).to_have_text("(1)")
    expect(countB).to_have_text("(1)")

    # Make sure only one layer has been created on peer B
    expect(peerB.locator("summary").get_by_text("Layer 1")).to_be_visible()

    # Save and quit edit mode again
    with peerA.expect_response(re.compile("./datalayer/create/.*")):
        peerA.get_by_role("button", name="Save").click()
    peerA.get_by_role("button", name="View", exact=True).click()
    expect(countA).to_have_text("(1)")
    expect(countB).to_have_text("(1)")
    peerA.wait_for_timeout(500)
    expect(countA).to_have_text("(1)")
    expect(countB).to_have_text("(1)")

    # Peer B should not be in state dirty
    expect(peerB.get_by_role("button", name="View", exact=True)).to_be_visible()
    expect(peerB.get_by_role("button", name="Cancel edits")).to_be_hidden()

    # Add a marker from peer B
    peerB.get_by_title("Draw a marker").click()
    peerB.locator("#map").click(position={"x": PANEL + 200, "y": 200})
    peerA.wait_for_timeout(300)  # Time for the panel animation to finish
    expect(countB).to_have_text("(2)")
    expect(countA).to_have_text("(1)")
    with peerB.expect_response(re.compile("./datalayer/update/.*")):
        peerB.get_by_role("button", name="Save").click()
    expect(countB).to_have_text("(2)")
    expect(countA).to_have_text("(1)")
    peerA.get_by_role("button", name="Edit", exact=True).click()
    expect(countA).to_have_text("(2)")
    expect(countB).to_have_text("(2)")


@pytest.mark.xdist_group(name="websockets")
def test_saved_datalayer_are_not_duplicated(
    syncmap, new_page, asgi_live_server, tilelayer, wait_for_loaded
):

    # Create one tab
    peerA = new_page("Page A")
    peerA.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerA)
    # Create a new datalayer
    peerA.get_by_title("Manage layers").click()
    peerA.get_by_role("button", name="Add a layer").click()
    peerA.locator("#map").click(position={"x": PANEL + 220, "y": 220})
    # Save layer to the server, so now the datalayer exist on the server AND
    # is still in the live operations of peer A
    with peerA.expect_response(re.compile(".*/datalayer/create/.*")):
        peerA.get_by_role("button", name="Save").click()

    # Now load the map from another tab
    peerB = new_page("Page B")
    peerB.goto(peerA.url)
    wait_for_loaded(peerB)
    expect(peerB.get_by_text("Layer 1")).to_be_visible()
    peerB.get_by_role("button", name="Edit", exact=True).click()
    peerA.wait_for_timeout(300)  # Let the synchro roll on.
    expect(peerB.get_by_text("Layer 1")).to_be_visible()


@pytest.mark.xdist_group(name="websockets")
def test_should_sync_saved_status(
    syncmap, new_page, asgi_live_server, tilelayer, wait_for_loaded
):

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit")
    wait_for_loaded(peerA)
    peerB = new_page("Page B")
    peerB.goto(f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit")
    wait_for_loaded(peerB)

    # Create a new marker from peerA
    peerA.get_by_title("Draw a marker").click()
    peerA.locator("#map").click(position={"x": PANEL + 220, "y": 220})

    # Peer A should be in dirty state
    expect(peerA.locator("body")).to_have_class(re.compile(".*umap-is-dirty.*"))

    # Peer B should not be in dirty state
    expect(peerB.locator("body")).not_to_have_class(re.compile(".*umap-is-dirty.*"))

    # Create a new marker from peerB
    peerB.get_by_title("Draw a marker").click()
    peerB.locator("#map").click(position={"x": PANEL + 200, "y": 250})

    # Peer B should be in dirty state
    expect(peerB.locator("body")).to_have_class(re.compile(".*umap-is-dirty.*"))

    # Peer A should still be in dirty state
    expect(peerA.locator("body")).to_have_class(re.compile(".*umap-is-dirty.*"))

    # Save layer to the server from peerA
    with peerA.expect_response(re.compile(".*/datalayer/create/.*")):
        peerA.get_by_role("button", name="Save").click()

    # Peer B should not be in dirty state
    expect(peerB.locator("body")).not_to_have_class(re.compile(".*umap-is-dirty.*"))

    # Peer A should not be in dirty state
    expect(peerA.locator("body")).not_to_have_class(re.compile(".*umap-is-dirty.*"))


@pytest.mark.xdist_group(name="websockets")
def test_should_sync_line_on_escape(
    syncmap, new_page, asgi_live_server, tilelayer, wait_for_loaded
):

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerA)
    peerB = new_page("Page B")
    peerB.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerB)

    # Create a new line from peerA
    peerA.get_by_title("Draw a polyline").click()
    peerA.locator("#map").click(position={"x": PANEL + 220, "y": 220})
    peerA.locator("#map").click(position={"x": PANEL + 200, "y": 200})
    peerA.locator("body").press("Escape")

    expect(peerA.locator(".umap-browser .feature.polyline")).to_have_count(1)
    expect(peerB.locator(".umap-browser .feature.polyline")).to_have_count(1)


@pytest.mark.xdist_group(name="websockets")
def test_should_sync_datalayer_clear(
    syncmap, datalayer, new_page, asgi_live_server, tilelayer, wait_for_loaded
):
    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerA)
    peerB = new_page("Page B")
    peerB.goto(
        f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit&onLoadPanel=databrowser"
    )
    wait_for_loaded(peerB)
    a_markers = peerA.locator(".umap-browser .feature.marker")
    b_markers = peerB.locator(".umap-browser .feature.marker")
    expect(a_markers).to_have_count(1)
    expect(b_markers).to_have_count(1)

    # Clear layer in peer A
    peerA.get_by_role("button", name="Manage layers").click()
    peerA.locator(".panel.right").get_by_role("button", name="Edit", exact=True).click()
    peerA.locator("summary").filter(has_text="Advanced actions").click()
    peerA.get_by_role("button", name="Empty").click()
    expect(a_markers).to_have_count(0)
    expect(b_markers).to_have_count(0)

    # Undo in peer A
    peerA.locator(".edit-undo").click()
    expect(a_markers).to_have_count(1)
    expect(b_markers).to_have_count(1)


@pytest.mark.xdist_group(name="websockets")
def test_should_save_remote_dirty_datalayers(
    syncmap, new_page, asgi_live_server, tilelayer, wait_for_loaded
):

    assert not DataLayer.objects.count()

    # Create two tabs
    peerA = new_page("Page A")
    peerA.goto(f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit")
    wait_for_loaded(peerA)
    peerB = new_page("Page B")
    peerB.goto(f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit")
    wait_for_loaded(peerB)

    # Create a new layer from peerA
    peerA.get_by_role("button", name="Manage layers").click()
    peerA.get_by_role("button", name="Add a layer").click()

    # Create a new layer from peerB
    peerB.get_by_role("button", name="Manage layers").click()
    peerB.get_by_role("button", name="Add a layer").click()

    # Save from peerA to the server
    counter = 0

    def on_response(response):
        nonlocal counter
        if "/datalayer/create/" in response.url:
            counter += 1
        # Wait for the two datalayer saves
        if counter == 2:
            return True
        return False

    with peerA.expect_response(on_response):
        peerA.get_by_role("button", name="Save").click()

    assert DataLayer.objects.count() == 2


def test_can_sync_new_parent_from_edit_panel(
    syncmap, asgi_live_server, tilelayer, new_page, wait_for_loaded
):
    DataLayerFactory(name="Parent Layer", map=syncmap, data=None, group=True)
    DataLayerFactory(name="Child Layer", map=syncmap, data=None)
    # Create two tabs
    peerA = new_page("Page A")
    response = peerA.goto(f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit")
    assert response.status == 200
    wait_for_loaded(peerA)
    peerB = new_page("Page B")
    peerB.goto(f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit")
    wait_for_loaded(peerB)

    peerA.get_by_role("button", name="Manage layers").click()
    peerA.get_by_role("button", name="Edit", exact=True).first.click()
    peerA.locator('select[name="parentId"]').select_option("Parent Layer")

    peerA.get_by_role("button", name="Manage layers").click()
    # Layer 1 should be under Layer 2
    parent = peerA.locator(".panel.right details").first
    expect(parent.locator("summary").first).to_have_text("Parent Layer")
    child = parent.locator("details").first
    expect(child.locator("summary").first).to_have_text("Child Layer")

    peerB.get_by_role("button", name="Manage layers").click()
    # Layer 1 should be under Layer 2
    parent = peerB.locator(".panel.right details").first
    expect(parent.locator("summary").first).to_have_text("Parent Layer")
    child = parent.locator("details").first
    expect(child.locator("summary").first).to_have_text("Child Layer")


def test_can_sync_remove_parent_from_edit_panel(
    page, syncmap, asgi_live_server, tilelayer, new_page, wait_for_loaded
):
    parent = DataLayerFactory(name="Parent Layer", map=syncmap, data=None, group=True)
    DataLayerFactory(name="Child Layer", map=syncmap, parent=parent)
    # Create two tabs
    peerA = new_page("Page A")
    response = peerA.goto(f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit")
    assert response.status == 200
    wait_for_loaded(peerA)
    peerB = new_page("Page B")
    peerB.goto(f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit")
    wait_for_loaded(peerB)

    peerA.get_by_role("button", name="Manage layers").click()
    peerA.get_by_role("button", name="Edit", exact=True).nth(1).click()
    peerA.locator('select[name="parentId"]').select_option("null")
    peerA.get_by_role("button", name="Manage layers").click()
    parentEl = peerA.locator(".panel.right details").last
    expect(parentEl.locator("summary").first).to_have_text("Parent Layer")
    # No child
    expect(parentEl.locator("details")).to_be_hidden()
    childEl = peerA.locator(".panel.right details").first
    expect(childEl.locator("summary").first).to_have_text("Child Layer")

    peerB.get_by_role("button", name="Manage layers").click()
    parentEl = peerB.locator(".panel.right details").last
    expect(parentEl.locator("summary").first).to_have_text("Parent Layer")
    # No child
    expect(parentEl.locator("details")).to_be_hidden()
    childEl = peerB.locator(".panel.right details").first
    expect(childEl.locator("summary").first).to_have_text("Child Layer")


def test_can_sync_change_parent_from_edit_panel(
    page, syncmap, asgi_live_server, tilelayer, new_page, wait_for_loaded
):
    parent = DataLayerFactory(name="Parent Layer", map=syncmap, data=None, group=True)
    child = DataLayerFactory(name="Child Layer", map=syncmap, parent=parent)
    other = DataLayerFactory(name="Other Layer", map=syncmap, data=None, group=True)
    # Create two tabs
    peerA = new_page("Page A")
    response = peerA.goto(f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit")
    assert response.status == 200
    wait_for_loaded(peerA)
    peerB = new_page("Page B")
    peerB.goto(f"{asgi_live_server.url}{syncmap.get_absolute_url()}?edit")
    wait_for_loaded(peerB)

    peerA.get_by_role("button", name="Manage layers").click()
    peerA.locator(f"summary[data-id='{child.pk}']").get_by_role(
        "button", name="Edit", exact=True
    ).click()
    peerA.locator('select[name="parentId"]').select_option("Other Layer")
    peerA.get_by_role("button", name="Manage layers").click()
    parentEl = peerA.locator(f".panel.right details[data-id='{parent.pk}']")
    expect(parentEl.locator("summary").first).to_have_text("Parent Layer")
    # No child
    expect(parentEl.locator("details")).to_be_hidden()
    otherEl = peerA.locator(f".panel.right details[data-id='{other.pk}']")
    expect(otherEl.locator("summary").first).to_have_text("Other Layer")
    childEl = otherEl.locator(f"details[data-id='{child.pk}']")
    expect(childEl.locator("summary").first).to_have_text("Child Layer")

    peerB.get_by_role("button", name="Manage layers").click()
    parentEl = peerA.locator(f".panel.right details[data-id='{parent.pk}']")
    expect(parentEl.locator("summary").first).to_have_text("Parent Layer")
    # No child
    expect(parentEl.locator("details")).to_be_hidden()
    otherEl = peerA.locator(f".panel.right details[data-id='{other.pk}']")
    expect(otherEl.locator("summary").first).to_have_text("Other Layer")
    childEl = otherEl.locator(f"details[data-id='{child.pk}']")
    expect(childEl.locator("summary").first).to_have_text("Child Layer")
