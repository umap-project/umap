import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


DATALAYER_DATA1 = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"mytype": "even", "name": "Point 2"},
            "geometry": {"type": "Point", "coordinates": [0.065918, 48.385442]},
        },
        {
            "type": "Feature",
            "properties": {"mytype": "odd", "name": "Point 1"},
            "geometry": {"type": "Point", "coordinates": [3.55957, 49.767074]},
        },
    ],
    "_umap_options": {
        "name": "Calque 1",
    },
}


DATALAYER_DATA2 = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"mytype": "even", "name": "Point 4"},
            "geometry": {"type": "Point", "coordinates": [0.856934, 45.290347]},
        },
        {
            "type": "Feature",
            "properties": {"mytype": "odd", "name": "Point 3"},
            "geometry": {"type": "Point", "coordinates": [4.372559, 47.945786]},
        },
    ],
    "_umap_options": {
        "name": "Calque 2",
    },
}


@pytest.fixture
def bootstrap(map, live_server):
    map.settings["properties"]["onLoadPanel"] = "facet"
    map.settings["properties"]["facetKey"] = "mytype|My type"
    map.settings["properties"]["showLabel"] = True
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA1)
    DataLayerFactory(map=map, data=DATALAYER_DATA2)


def test_simple_facet_search(live_server, page, bootstrap, map):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    panel = page.locator(".umap-facet-search")
    expect(panel).to_be_visible()
    # Facet name
    expect(page.get_by_text("My type")).to_be_visible()
    # Facet values
    oven = page.get_by_text("even")
    odd = page.get_by_text("odd")
    expect(oven).to_be_visible()
    expect(odd).to_be_visible()
    markers = page.locator(".leaflet-marker-icon")
    expect(markers).to_have_count(4)
    # Tooltips
    expect(page.get_by_text("Point 1")).to_be_visible()
    expect(page.get_by_text("Point 2")).to_be_visible()
    expect(page.get_by_text("Point 3")).to_be_visible()
    expect(page.get_by_text("Point 4")).to_be_visible()
    # Now let's filter
    odd.click()
    expect(markers).to_have_count(2)
    expect(page.get_by_text("Point 2")).to_be_hidden()
    expect(page.get_by_text("Point 4")).to_be_hidden()
    expect(page.get_by_text("Point 1")).to_be_visible()
    expect(page.get_by_text("Point 3")).to_be_visible()
    # Now let's filter
    odd.click()
    expect(markers).to_have_count(4)
