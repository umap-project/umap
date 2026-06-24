import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.django_db


def test_route_button_is_hidden(page, live_server, tilelayer, settings):
    page.goto(f"{live_server.url}/en/map/new/#14/47.7591/2.4134")
    expect(page.get_by_role("button", name="Draw along routes")).to_be_hidden()


def test_draw_route(page, live_server, tilelayer, settings):
    settings.OPENROUTESERVICE_APIKEY = "FOOBAR="
    cycling_response = {
        "type": "FeatureCollection",
        "bbox": [2.367278, 47.768019, 2.375744, 47.774736],
        "features": [
            {
                "bbox": [2.367278, 47.768019, 2.375744, 47.774736],
                "type": "Feature",
                "properties": {
                    "way_points": [0, 31],
                    "summary": {"distance": 1228.2, "duration": 308.4},
                },
                "geometry": {
                    "coordinates": [
                        [2.367419, 47.77416],
                        [2.367278, 47.774736],
                        [2.367914, 47.774734],
                        [2.367982, 47.774676],
                        [2.368261, 47.774569],
                        [2.368397, 47.774488],
                        [2.368517, 47.774396],
                        [2.368745, 47.77417],
                        [2.368963, 47.773917],
                        [2.369246, 47.773728],
                        [2.369376, 47.773669],
                        [2.37024, 47.773401],
                        [2.370303, 47.773393],
                        [2.370277, 47.7733],
                        [2.37047, 47.77325],
                        [2.371473, 47.772904],
                        [2.371666, 47.772883],
                        [2.371669, 47.772587],
                        [2.37161, 47.772529],
                        [2.371584, 47.772466],
                        [2.371589, 47.772401],
                        [2.371672, 47.772301],
                        [2.371801, 47.77225],
                        [2.371875, 47.772172],
                        [2.371966, 47.771983],
                        [2.372052, 47.77171],
                        [2.373877, 47.768035],
                        [2.374129, 47.768118],
                        [2.374149, 47.768088],
                        [2.374132, 47.768019],
                        [2.375642, 47.768538],
                        [2.375744, 47.768386],
                    ],
                    "type": "LineString",
                },
            }
        ],
        "metadata": {
            "attribution": "openrouteservice.org | OpenStreetMap contributors",
            "service": "routing",
            "timestamp": 1753716213909,
            "query": {
                "coordinates": [[2.367039, 47.774118], [2.375622, 47.768349]],
                "profile": "cycling-regular",
                "profileName": "cycling-regular",
                "preference": "recommended",
                "format": "geojson",
                "geometry_simplify": True,
            },
            "engine": {
                "version": "9.3.0",
                "build_date": "2025-06-06T15:39:25Z",
                "graph_date": "2025-06-22T07:54:02Z",
                "osm_date": "1970-01-01T00:00:00Z",
            },
        },
    }

    car_response = {
        "type": "FeatureCollection",
        "bbox": [2.367278, 47.768035, 2.375458, 47.774736],
        "features": [
            {
                "bbox": [2.367278, 47.768035, 2.375458, 47.774736],
                "type": "Feature",
                "properties": {
                    "way_points": [0, 17],
                    "summary": {"distance": 1283.8, "duration": 160.8},
                },
                "geometry": {
                    "coordinates": [
                        [2.367419, 47.77416],
                        [2.367278, 47.774736],
                        [2.367476, 47.774736],
                        [2.367495, 47.774429],
                        [2.367601, 47.773963],
                        [2.367799, 47.773307],
                        [2.368261, 47.772056],
                        [2.370046, 47.772198],
                        [2.371213, 47.772406],
                        [2.371469, 47.772383],
                        [2.371625, 47.772341],
                        [2.371672, 47.772301],
                        [2.371801, 47.77225],
                        [2.371875, 47.772172],
                        [2.371966, 47.771983],
                        [2.372052, 47.77171],
                        [2.373877, 47.768035],
                        [2.375458, 47.768569],
                    ],
                    "type": "LineString",
                },
            }
        ],
        "metadata": {
            "attribution": "openrouteservice.org | OpenStreetMap contributors",
            "service": "routing",
            "timestamp": 1753717466321,
            "query": {
                "coordinates": [[2.367039, 47.774118], [2.375622, 47.768349]],
                "profile": "driving-car",
                "profileName": "driving-car",
                "preference": "recommended",
                "format": "geojson",
                "geometry_simplify": True,
            },
            "engine": {
                "version": "9.3.0",
                "build_date": "2025-06-06T15:39:25Z",
                "graph_date": "2025-06-23T11:47:36Z",
                "osm_date": "1970-01-01T00:00:00Z",
            },
        },
    }

    def handle_cycling(route):
        route.fulfill(json=cycling_response)

    def handle_car(route):
        route.fulfill(json=car_response)

    # Intercept the route
    page.route(
        "https://api.openrouteservice.org/v2/directions/cycling-regular/geojson",
        handle_cycling,
    )
    page.route(
        "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
        handle_car,
    )
    page.goto(f"{live_server.url}/en/map/new/#14/47.7591/2.4134")
    expect(page.locator("path")).to_be_hidden()
    expect(page.locator(".leaflet-vertex-icon")).to_be_hidden()
    page.get_by_role("button", name="Draw along routes").click()
    page.locator('select[name="profile"]').select_option("cycling-regular")
    page.get_by_role("button", name="OK").click()
    page.locator("#map").click(position={"x": 100, "y": 100})
    page.locator("#map").click(position={"x": 200, "y": 200})
    page.locator("#map").click(position={"x": 200, "y": 200})
    expect(page.locator("path")).to_be_visible()
    expect(page.locator(".leaflet-vertex-icon")).to_have_count(2)
    page.get_by_text("Advanced actions").click()
    page.get_by_role("button", name="Transform to regular line").click()
    expect(page.locator(".leaflet-vertex-icon")).to_have_count(32)
    page.get_by_text("Advanced actions").click()
    page.get_by_role("button", name="Restore route").click()
    expect(page.locator(".leaflet-vertex-icon")).to_have_count(2)
    page.locator('#edit-route select[name="profile"]').select_option("driving-car")
    page.get_by_role("button", name="Compute route").click()
    page.get_by_text("Advanced actions").click()
    page.get_by_role("button", name="Transform to regular line").click()
    expect(page.locator(".leaflet-vertex-icon")).to_have_count(18)
