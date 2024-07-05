import json
from pathlib import Path

import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


def test_basic_categorized_map_with_default_color(map, live_server, page):
    path = Path(__file__).parent.parent / "fixtures/categorized_highway.geojson"
    data = json.loads(path.read_text())
    DataLayerFactory(data=data, map=map)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#13/48.4378/3.3043")
    # residential
    expect(page.locator("path[stroke='#7fc97f']")).to_have_count(5)
    # secondary
    expect(page.locator("path[stroke='#beaed4']")).to_have_count(1)
    # service
    expect(page.locator("path[stroke='#fdc086']")).to_have_count(2)
    # tertiary
    expect(page.locator("path[stroke='#ffff99']")).to_have_count(6)
    # track
    expect(page.locator("path[stroke='#386cb0']")).to_have_count(11)
    # unclassified
    expect(page.locator("path[stroke='#f0027f']")).to_have_count(7)


def test_basic_categorized_map_with_custom_brewer(openmap, live_server, page):
    path = Path(__file__).parent.parent / "fixtures/categorized_highway.geojson"
    data = json.loads(path.read_text())

    # Change brewer at load
    data["_umap_options"]["categorized"]["brewer"] = "Spectral"
    DataLayerFactory(data=data, map=openmap)

    page.goto(f"{live_server.url}{openmap.get_absolute_url()}#13/48.4378/3.3043")
    # residential
    expect(page.locator("path[stroke='#d53e4f']")).to_have_count(5)
    # secondary
    expect(page.locator("path[stroke='#fc8d59']")).to_have_count(1)
    # service
    expect(page.locator("path[stroke='#fee08b']")).to_have_count(2)
    # tertiary
    expect(page.locator("path[stroke='#e6f598']")).to_have_count(6)
    # track
    expect(page.locator("path[stroke='#99d594']")).to_have_count(11)
    # unclassified
    expect(page.locator("path[stroke='#3288bd']")).to_have_count(7)

    # Now change brewer from UI
    page.get_by_role("button", name="Edit").click()
    page.get_by_role("link", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit", exact=True).click()
    page.get_by_text("Categorized: settings").click()
    page.locator('select[name="brewer"]').select_option("Paired")

    # residential
    expect(page.locator("path[stroke='#a6cee3']")).to_have_count(5)
    # secondary
    expect(page.locator("path[stroke='#1f78b4']")).to_have_count(1)
    # service
    expect(page.locator("path[stroke='#b2df8a']")).to_have_count(2)
    # tertiary
    expect(page.locator("path[stroke='#33a02c']")).to_have_count(6)
    # track
    expect(page.locator("path[stroke='#fb9a99']")).to_have_count(11)
    # unclassified
    expect(page.locator("path[stroke='#e31a1c']")).to_have_count(7)


def test_basic_categorized_map_with_custom_categories(openmap, live_server, page):
    path = Path(__file__).parent.parent / "fixtures/categorized_highway.geojson"
    data = json.loads(path.read_text())

    # Change categories at load
    data["_umap_options"]["categorized"]["categories"] = (
        "unclassified,track,service,residential,tertiary,secondary"
    )
    data["_umap_options"]["categorized"]["mode"] = "manual"
    DataLayerFactory(data=data, map=openmap)

    page.goto(f"{live_server.url}{openmap.get_absolute_url()}#13/48.4378/3.3043")

    # unclassified
    expect(page.locator("path[stroke='#7fc97f']")).to_have_count(7)
    # track
    expect(page.locator("path[stroke='#beaed4']")).to_have_count(11)
    # service
    expect(page.locator("path[stroke='#fdc086']")).to_have_count(2)
    # residential
    expect(page.locator("path[stroke='#ffff99']")).to_have_count(5)
    # tertiary
    expect(page.locator("path[stroke='#386cb0']")).to_have_count(6)
    # secondary
    expect(page.locator("path[stroke='#f0027f']")).to_have_count(1)

    # Now change categories from UI
    page.get_by_role("button", name="Edit").click()
    page.get_by_role("link", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit", exact=True).click()
    page.get_by_text("Categorized: settings").click()
    page.locator('input[name="categories"]').fill(
        "secondary,tertiary,residential,service,track,unclassified"
    )
    page.locator('input[name="categories"]').blur()

    # secondary
    expect(page.locator("path[stroke='#7fc97f']")).to_have_count(1)
    # tertiary
    expect(page.locator("path[stroke='#beaed4']")).to_have_count(6)
    # residential
    expect(page.locator("path[stroke='#fdc086']")).to_have_count(5)
    # service
    expect(page.locator("path[stroke='#ffff99']")).to_have_count(2)
    # track
    expect(page.locator("path[stroke='#386cb0']")).to_have_count(11)
    # unclassified
    expect(page.locator("path[stroke='#f0027f']")).to_have_count(7)

    # Now go back to automatic categories
    page.get_by_role("button", name="Edit").click()
    page.get_by_role("link", name="Manage layers").click()
    page.locator(".panel").get_by_title("Edit", exact=True).click()
    page.get_by_text("Categorized: settings").click()
    page.get_by_text("Alphabetical").click()

    # residential
    expect(page.locator("path[stroke='#7fc97f']")).to_have_count(5)
    # secondary
    expect(page.locator("path[stroke='#beaed4']")).to_have_count(1)
    # service
    expect(page.locator("path[stroke='#fdc086']")).to_have_count(2)
    # tertiary
    expect(page.locator("path[stroke='#ffff99']")).to_have_count(6)
    # track
    expect(page.locator("path[stroke='#386cb0']")).to_have_count(11)
    # unclassified
    expect(page.locator("path[stroke='#f0027f']")).to_have_count(7)
