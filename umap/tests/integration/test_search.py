from playwright.sync_api import expect


def test_reverse_search(live_server, page, tilelayer):
    photon_response = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "osm_type": "N",
                    "osm_id": 5055853416,
                    "osm_key": "place",
                    "osm_value": "locality",
                    "type": "locality",
                    "postcode": "10200",
                    "countrycode": "FR",
                    "name": "Le Haut Sentier",
                    "country": "France",
                    "city": "Thors",
                    "state": "Grand Est",
                    "county": "Aube",
                },
                "geometry": {"type": "Point", "coordinates": [4.7995256, 48.2985251]},
            }
        ],
    }
    page.goto(f"{live_server.url}/en/map/new")

    def handle_search(route):
        route.fulfill(json=photon_response)

    # Intercept the route
    page.route(
        "https://photon.komoot.io/reverse/?limit=1&lat=48.3&lon=4.8",
        handle_search,
    )
    page.get_by_role("button", name="Search location").click()
    page.get_by_role("searchbox", name="Type a place name or").fill("48.3 4.8")
    expect(page.get_by_text("48.3 4.8")).to_be_visible()
    expect(page.get_by_text("Le Haut Sentier")).to_be_visible()


def test_can_add_the_geometry_of_a_search_result_to_the_map(
    live_server, page, tilelayer
):
    photon_response = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "osm_type": "W",
                    "osm_id": 123,
                    "osm_key": "highway",
                    "osm_value": "footway",
                    "name": "Chemin du Test",
                    "country": "France",
                },
                "geometry": {"type": "Point", "coordinates": [2.15, 48.2]},
            }
        ],
    }
    osm_response = """<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <node id="1" lat="48.1" lon="2.1"/>
  <node id="2" lat="48.2" lon="2.2"/>
  <node id="3" lat="48.3" lon="2.1"/>
  <way id="123">
    <nd ref="1"/>
    <nd ref="2"/>
    <nd ref="3"/>
    <tag k="highway" v="footway"/>
    <tag k="name" v="Chemin du Test"/>
  </way>
</osm>"""
    page.route(
        "https://photon.komoot.io/api/?**",
        lambda route: route.fulfill(json=photon_response),
    )
    page.route(
        "https://www.openstreetmap.org/api/0.6/way/123/full",
        lambda route: route.fulfill(body=osm_response, content_type="text/xml"),
    )
    page.goto(f"{live_server.url}/en/map/new")
    page.get_by_role("button", name="Search location").click()
    page.get_by_role("searchbox", name="Type a place name or").fill("Chemin du Test")
    expect(page.get_by_text("Chemin du Test")).to_be_visible()
    page.get_by_title("Add this geometry to my map").dispatch_event("mousedown")
    page.get_by_title("Open browser").click()
    page.locator(".umap-browser .datalayer").first.click()
    expect(page.locator(".umap-browser .feature.polyline")).to_have_count(1)
