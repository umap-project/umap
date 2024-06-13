import json
import re
from pathlib import Path
from time import sleep

from playwright.sync_api import expect

from umap.models import DataLayer

from ..base import DataLayerFactory, MapFactory

DATALAYER_UPDATE = re.compile(r".*/datalayer/update/.*")


def test_created_markers_are_merged(context, live_server, tilelayer):
    # Let's create a new map with an empty datalayer
    map = MapFactory(name="server-side merge")
    datalayer = DataLayerFactory(map=map, edit_status=DataLayer.ANONYMOUS, data={})

    # Now navigate to this map and create marker
    page_one = context.new_page()
    page_one.goto(f"{live_server.url}{map.get_absolute_url()}?edit")

    save_p1 = page_one.get_by_role("button", name="Save")
    expect(save_p1).to_be_visible()

    # Click on the Draw a marker button on a new map.
    create_marker_p1 = page_one.get_by_title("Draw a marker")
    expect(create_marker_p1).to_be_visible()
    create_marker_p1.click()

    # Check no marker is present by default.
    marker_pane_p1 = page_one.locator(".leaflet-marker-pane > div")
    expect(marker_pane_p1).to_have_count(0)

    # Click on the map, it will place a marker at the given position.
    map_el_p1 = page_one.locator("#map")
    map_el_p1.click(position={"x": 200, "y": 200})
    expect(marker_pane_p1).to_have_count(1)

    with page_one.expect_response(DATALAYER_UPDATE):
        save_p1.click()
        # Prevent two layers to be saved on the same second, as we compare them based
        # on time in case of conflict. FIXME do not use time for comparison.
        sleep(1)
    assert DataLayer.objects.get(pk=datalayer.pk).settings == {
        "browsable": True,
        "displayOnLoad": True,
        "name": "test datalayer",
        "editMode": "advanced",
        "inCaption": True,
    }

    # Now navigate to this map from another tab
    page_two = context.new_page()

    page_two.goto(f"{live_server.url}{map.get_absolute_url()}?edit")

    save_p2 = page_two.get_by_role("button", name="Save")
    expect(save_p2).to_be_visible()

    # Click on the Draw a marker button on a new map.
    create_marker_p2 = page_two.get_by_title("Draw a marker")
    expect(create_marker_p2).to_be_visible()
    create_marker_p2.click()

    # Check that the marker created in the orther tab is present.
    marker_pane_p2 = page_two.locator(".leaflet-marker-pane > div")
    expect(marker_pane_p2).to_have_count(1)

    # Click on the map, it will place a marker at the given position.
    map_el_p2 = page_two.locator("#map")
    map_el_p2.click(position={"x": 220, "y": 220})
    expect(marker_pane_p2).to_have_count(2)

    with page_two.expect_response(DATALAYER_UPDATE):
        save_p2.click()
        sleep(1)
    # No change after the save
    expect(marker_pane_p2).to_have_count(2)
    assert DataLayer.objects.get(pk=datalayer.pk).settings == {
        "browsable": True,
        "displayOnLoad": True,
        "name": "test datalayer",
        "inCaption": True,
        "editMode": "advanced",
    }

    # Now create another marker in the first tab
    create_marker_p1.click()
    map_el_p1.click(position={"x": 150, "y": 150})
    expect(marker_pane_p1).to_have_count(2)
    with page_one.expect_response(DATALAYER_UPDATE):
        save_p1.click()
    # Should now get the other marker too
    expect(marker_pane_p1).to_have_count(3)
    assert DataLayer.objects.get(pk=datalayer.pk).settings == {
        "browsable": True,
        "displayOnLoad": True,
        "name": "test datalayer",
        "inCaption": True,
        "editMode": "advanced",
        "id": str(datalayer.pk),
        "permissions": {"edit_status": 1},
    }

    # And again
    create_marker_p1.click()
    map_el_p1.click(position={"x": 180, "y": 150})
    expect(marker_pane_p1).to_have_count(4)
    with page_one.expect_response(DATALAYER_UPDATE):
        save_p1.click()
        sleep(1)
    # Should now get the other marker too
    assert DataLayer.objects.get(pk=datalayer.pk).settings == {
        "browsable": True,
        "displayOnLoad": True,
        "name": "test datalayer",
        "inCaption": True,
        "editMode": "advanced",
        "id": str(datalayer.pk),
        "permissions": {"edit_status": 1},
    }
    expect(marker_pane_p1).to_have_count(4)

    # And again from the second tab
    expect(marker_pane_p2).to_have_count(2)
    create_marker_p2.click()
    map_el_p2.click(position={"x": 250, "y": 150})
    expect(marker_pane_p2).to_have_count(3)
    with page_two.expect_response(DATALAYER_UPDATE):
        save_p2.click()
        sleep(1)
    # Should now get the other markers too
    assert DataLayer.objects.get(pk=datalayer.pk).settings == {
        "browsable": True,
        "displayOnLoad": True,
        "name": "test datalayer",
        "inCaption": True,
        "editMode": "advanced",
        "id": str(datalayer.pk),
        "permissions": {"edit_status": 1},
    }
    expect(marker_pane_p2).to_have_count(5)


def test_empty_datalayers_can_be_merged(context, live_server, tilelayer):
    # Let's create a new map with an empty datalayer
    map = MapFactory(name="server-side merge")
    DataLayerFactory(map=map, edit_status=DataLayer.ANONYMOUS, data={})

    # Open two tabs at the same time, on the same empty map
    page_one = context.new_page()
    page_one.goto(f"{live_server.url}{map.get_absolute_url()}?edit")

    page_two = context.new_page()
    page_two.goto(f"{live_server.url}{map.get_absolute_url()}?edit")

    save_p1 = page_one.get_by_role("button", name="Save")
    expect(save_p1).to_be_visible()

    # Click on the Draw a marker button on a new map.
    create_marker_p1 = page_one.get_by_title("Draw a marker")
    expect(create_marker_p1).to_be_visible()
    create_marker_p1.click()

    # Check no marker is present by default.
    marker_pane_p1 = page_one.locator(".leaflet-marker-pane > div")
    expect(marker_pane_p1).to_have_count(0)

    # Click on the map, it will place a marker at the given position.
    map_el_p1 = page_one.locator("#map")
    map_el_p1.click(position={"x": 200, "y": 200})
    expect(marker_pane_p1).to_have_count(1)

    with page_one.expect_response(DATALAYER_UPDATE):
        save_p1.click()
        sleep(1)

    save_p2 = page_two.get_by_role("button", name="Save")
    expect(save_p2).to_be_visible()

    # Click on the Draw a marker button on a new map.
    create_marker_p2 = page_two.get_by_title("Draw a marker")
    expect(create_marker_p2).to_be_visible()
    create_marker_p2.click()

    marker_pane_p2 = page_two.locator(".leaflet-marker-pane > div")

    # Click on the map, it will place a marker at the given position.
    map_el_p2 = page_two.locator("#map")
    map_el_p2.click(position={"x": 220, "y": 220})
    expect(marker_pane_p2).to_have_count(1)

    # Save p1 and p2 at the same time
    with page_two.expect_response(DATALAYER_UPDATE):
        save_p2.click()
        sleep(1)

    expect(marker_pane_p2).to_have_count(2)


def test_same_second_edit_doesnt_conflict(context, live_server, tilelayer):
    # Let's create a new map with an empty datalayer
    map = MapFactory(name="server-side merge")
    datalayer = DataLayerFactory(map=map, edit_status=DataLayer.ANONYMOUS, data={})

    # Open the created map on two pages.
    page_one = context.new_page()
    page_one.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    page_two = context.new_page()
    page_two.goto(f"{live_server.url}{map.get_absolute_url()}?edit")

    save_p1 = page_one.get_by_role("button", name="Save")
    expect(save_p1).to_be_visible()

    save_p2 = page_two.get_by_role("button", name="Save")
    expect(save_p2).to_be_visible()

    # Create a point on the first map
    create_marker_p1 = page_one.get_by_title("Draw a marker")
    expect(create_marker_p1).to_be_visible()
    create_marker_p1.click()

    # Check no marker is present by default.
    marker_pane_p1 = page_one.locator(".leaflet-marker-pane > div")
    expect(marker_pane_p1).to_have_count(0)

    # Click on the map, it will place a marker at the given position.
    map_el_p1 = page_one.locator("#map")
    map_el_p1.click(position={"x": 200, "y": 200})
    expect(marker_pane_p1).to_have_count(1)

    # And add one on the second map as well.
    create_marker_p2 = page_two.get_by_title("Draw a marker")
    expect(create_marker_p2).to_be_visible()
    create_marker_p2.click()

    marker_pane_p2 = page_two.locator(".leaflet-marker-pane > div")

    # Click on the map, it will place a marker at the given position.
    map_el_p2 = page_two.locator("#map")
    map_el_p2.click(position={"x": 220, "y": 220})
    expect(marker_pane_p2).to_have_count(1)

    # Save the two tabs at the same time
    with page_one.expect_response(DATALAYER_UPDATE):
        save_p1.click()
        sleep(0.2)  # Needed to avoid having multiple requests coming at the same time.
        save_p2.click()

    # Now create another marker in the first tab
    create_marker_p1.click()
    map_el_p1.click(position={"x": 150, "y": 150})
    expect(marker_pane_p1).to_have_count(2)
    with page_one.expect_response(DATALAYER_UPDATE):
        save_p1.click()

    # Should now get the other marker too
    expect(marker_pane_p1).to_have_count(3)
    assert DataLayer.objects.get(pk=datalayer.pk).settings == {
        "browsable": True,
        "displayOnLoad": True,
        "name": "test datalayer",
        "inCaption": True,
        "editMode": "advanced",
        "id": str(datalayer.pk),
        "permissions": {"edit_status": 1},
    }


def test_should_display_alert_on_conflict(context, live_server, datalayer, openmap):
    # Open the map on two pages.
    page_one = context.new_page()
    page_one.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page_two = context.new_page()
    page_two.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")

    page_one.locator(".leaflet-marker-icon").click(modifiers=["Shift"])
    page_one.locator('input[name="name"]').fill("new name")
    with page_one.expect_response(re.compile(r".*/datalayer/update/.*")):
        page_one.get_by_role("button", name="Save").click()

    page_two.locator(".leaflet-marker-icon").click(modifiers=["Shift"])
    page_two.locator('input[name="name"]').fill("custom name")
    with page_two.expect_response(re.compile(r".*/datalayer/update/.*")):
        page_two.get_by_role("button", name="Save").click()
    saved = DataLayer.objects.last()
    data = json.loads(Path(saved.geojson.path).read_text())
    assert data["features"][0]["properties"]["name"] == "new name"
    expect(page_two.get_by_text("Whoops! Other contributor(s) changed")).to_be_visible()
    with page_two.expect_response(re.compile(r".*/datalayer/update/.*")):
        page_two.get_by_text("Keep your changes and loose theirs").click()
    saved = DataLayer.objects.last()
    data = json.loads(Path(saved.geojson.path).read_text())
    assert data["features"][0]["properties"]["name"] == "custom name"
