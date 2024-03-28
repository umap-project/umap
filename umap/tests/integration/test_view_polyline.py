import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db

DATALAYER_DATA = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"name": "name line", "description": "line description"},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    # Flat line so PW will click on it
                    # (it compute the center of the element)
                    [11.25, 53.585984],
                    [10.151367, 52.975108],
                ],
            },
        },
    ],
}


@pytest.fixture
def bootstrap(map, live_server):
    map.settings["properties"]["zoom"] = 6
    map.settings["geometry"] = {
        "type": "Point",
        "coordinates": [8.429, 53.239],
    }
    map.save()
    DataLayerFactory(map=map, data=DATALAYER_DATA)


def test_should_open_popup_on_click(live_server, map, page, bootstrap):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    line = page.locator("path").first
    expect(line).to_have_attribute("stroke-opacity", "0.5")
    line.click()
    expect(page.locator(".leaflet-popup-content-wrapper")).to_be_visible()
    expect(page.get_by_role("heading", name="name line")).to_be_visible()
    expect(page.get_by_text("line description")).to_be_visible()
    # It's not a round value
    expect(line).to_have_attribute("stroke-opacity", "1")
    # Close popup
    page.locator("#map").click()
    expect(line).to_have_attribute("stroke-opacity", "0.5")
