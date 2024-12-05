import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db

OSM_DATA = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [2.49, 48.79]},
            "properties": {
                "amenity": "restaurant",
                "cuisine": "italian",
                "name": "A Casa di Nonna",
                "panoramax": "d811b398-d930-4cf8-95a2-0c29c34d9fca",
                "phone": "+33 1 48 89 54 12",
                "takeaway:covid19": "yes",
                "wheelchair": "no",
                "id": "node/1130849864",
            },
            "id": "AzMjk",
        },
    ],
    "_umap_options": {
        "popupTemplate": "OSM",
    },
}


def test_openstreetmap_popup(live_server, map, page):
    DataLayerFactory(map=map, data=OSM_DATA)
    page.goto(f"{live_server.url}{map.get_absolute_url()}#18/48.79/2.49")
    expect(page.locator(".umap-icon-active")).to_be_hidden()
    page.locator(".leaflet-marker-icon").click()
    expect(page.get_by_role("heading", name="A Casa di Nonna")).to_be_visible()
    expect(page.get_by_text("+33 1 48 89 54 12")).to_be_visible()
    img = page.locator(".umap-popup-content img")
    expect(img).to_have_attribute(
        "src",
        "https://api.panoramax.xyz/api/pictures/d811b398-d930-4cf8-95a2-0c29c34d9fca/sd.jpg",
    )
