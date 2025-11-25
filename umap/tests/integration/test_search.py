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
