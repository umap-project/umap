import pytest
from playwright.sync_api import expect

from .helpers import save_and_get_json

pytestmark = pytest.mark.django_db


def test_draw_polygon(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a polygon button on a new map.
    create_line = page.locator(".leaflet-control-toolbar ").get_by_title(
        "Draw a polygon"
    )
    create_line.click()

    # Check no polygon is present by default.
    # We target with the color, because there is also the drawing line guide (dash-array)
    # around
    lines = page.locator(".leaflet-overlay-pane path[stroke='DarkBlue']")
    guide = page.locator(".leaflet-overlay-pane > svg > g > path")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)

    # Click on the map, it will create a polygon.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(1)
    map.click(position={"x": 100, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(2)
    map.click(position={"x": 100, "y": 100})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(2)
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(0)


def test_clicking_esc_should_finish_polygon(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a polygon button on a new map.
    create_line = page.locator(".leaflet-control-toolbar ").get_by_title(
        "Draw a polygon"
    )
    create_line.click()

    # Check no polygon is present by default.
    # We target with the color, because there is also the drawing line guide (dash-array)
    # around
    lines = page.locator(".leaflet-overlay-pane path[stroke='DarkBlue']")
    guide = page.locator(".leaflet-overlay-pane > svg > g > path")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)

    # Click on the map, it will create a polygon.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(1)
    map.click(position={"x": 100, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(2)
    map.click(position={"x": 100, "y": 100})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(2)
    # Click ESC to finish
    page.keyboard.press("Escape")
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(0)
    # Should have opened edit form panel
    expect(page.locator(".panel").get_by_text("Feature properties")).to_be_visible()


def test_clicking_esc_should_delete_polygon_if_empty(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a polygon button on a new map.
    create_line = page.locator(".leaflet-control-toolbar ").get_by_title(
        "Draw a polygon"
    )
    create_line.click()

    # Check no polygon is present by default.
    # We target with the color, because there is also the drawing line guide (dash-array)
    # around
    lines = page.locator(".leaflet-overlay-pane path[stroke='DarkBlue']")
    guide = page.locator(".leaflet-overlay-pane > svg > g > path")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)

    # Click ESC to finish, no polygon should have been created
    page.keyboard.press("Escape")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)
    # Should not have opened edit form panel
    expect(page.locator(".panel").get_by_text("Feature properties")).to_be_hidden()


def test_clicking_esc_should_delete_polygon_if_invalid(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a polygon button on a new map.
    create_line = page.locator(".leaflet-control-toolbar ").get_by_title(
        "Draw a polygon"
    )
    create_line.click()

    # Check no polygon is present by default.
    # We target with the color, because there is also the drawing line guide (dash-array)
    # around
    lines = page.locator(".leaflet-overlay-pane path[stroke='DarkBlue']")
    guide = page.locator(".leaflet-overlay-pane > svg > g > path")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)

    # Click on the map twice, it will start a polygon.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(1)
    map.click(position={"x": 100, "y": 200})
    expect(lines).to_have_count(1)
    expect(guide).to_have_count(2)
    # Click ESC to finish, the polygon is invalid, it should not be persisted
    page.keyboard.press("Escape")
    expect(lines).to_have_count(0)
    expect(guide).to_have_count(0)
    # Should not have opened edit form panel
    expect(page.locator(".panel").get_by_text("Feature properties")).to_be_hidden()


def test_can_draw_multi(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    polygons = page.locator(".leaflet-overlay-pane path")
    expect(polygons).to_have_count(0)
    multi_button = page.get_by_title("Add a polygon to the current multi")
    expect(multi_button).to_be_hidden()
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 150, "y": 100})
    map.click(position={"x": 150, "y": 150})
    map.click(position={"x": 100, "y": 150})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(multi_button).to_be_visible()
    expect(polygons).to_have_count(1)
    multi_button.click()
    map.click(position={"x": 250, "y": 200})
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    expect(polygons).to_have_count(1)
    page.keyboard.press("Escape")
    expect(multi_button).to_be_hidden()
    polygons.first.click(button="right", position={"x": 10, "y": 10})
    expect(page.get_by_role("button", name="Transform to lines")).to_be_hidden()
    expect(
        page.get_by_role("button", name="Remove shape from the multi")
    ).to_be_visible()


def test_can_draw_hole(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    page.get_by_title("Draw a polygon").click()

    polygons = page.locator(".leaflet-overlay-pane path")
    vertices = page.locator(".leaflet-vertex-icon")

    # Click on the map, it will create a polygon.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(polygons).to_have_count(1)
    expect(vertices).to_have_count(4)

    # First vertex of the hole will be created here
    map.click(position={"x": 180, "y": 120})
    page.get_by_role("link", name="Start a hole here").click()
    map.click(position={"x": 180, "y": 180})
    map.click(position={"x": 120, "y": 180})
    map.click(position={"x": 120, "y": 120})
    # Click again to finish
    map.click(position={"x": 120, "y": 120})
    expect(polygons).to_have_count(1)
    expect(vertices).to_have_count(8)
    # Click on the polygon but not in the hole
    polygons.first.click(button="right", position={"x": 10, "y": 10})
    expect(page.get_by_role("button", name="Transform to lines")).to_be_hidden()


def test_can_transfer_shape_from_simple_polygon(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    polygons = page.locator(".leaflet-overlay-pane path")
    expect(polygons).to_have_count(0)
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")

    # Draw a first polygon
    map.click(position={"x": 150, "y": 100})
    map.click(position={"x": 150, "y": 150})
    map.click(position={"x": 100, "y": 150})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(polygons).to_have_count(1)

    # Draw another polygon
    page.get_by_title("Draw a polygon").click()
    map.click(position={"x": 250, "y": 200})
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    expect(polygons).to_have_count(2)

    # Now that polygon 2 is selected, right click on first one
    # and transfer shape
    polygons.first.click(position={"x": 20, "y": 20}, button="right")
    page.get_by_role("button", name="Transfer shape to edited feature").click()
    expect(polygons).to_have_count(1)


def test_can_extract_shape(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    polygons = page.locator(".leaflet-overlay-pane path")
    expect(polygons).to_have_count(0)
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 150, "y": 100})
    map.click(position={"x": 150, "y": 150})
    map.click(position={"x": 100, "y": 150})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(polygons).to_have_count(1)
    extract_button = page.get_by_role(
        "button", name="Extract shape to separate feature"
    )
    expect(extract_button).to_be_hidden()
    page.get_by_title("Add a polygon to the current multi").click()
    map.click(position={"x": 250, "y": 200})
    map.click(position={"x": 250, "y": 250})
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    expect(polygons).to_have_count(1)
    polygons.first.click(position={"x": 20, "y": 20}, button="right")
    extract_button.click()
    expect(polygons).to_have_count(2)
    data = save_and_get_json(page)
    assert len(data["features"]) == 2
    assert data["features"][0]["geometry"]["type"] == "Polygon"
    assert data["features"][1]["geometry"]["type"] == "Polygon"
    assert data["features"][0]["geometry"]["coordinates"] == [
        [
            [
                -6.569824,
                53.159947,
            ],
            [
                -6.569824,
                52.49616,
            ],
            [
                -7.668457,
                52.49616,
            ],
            [
                -7.668457,
                53.159947,
            ],
            [
                -6.569824,
                53.159947,
            ],
        ],
    ]
    assert data["features"][1]["geometry"]["coordinates"] == [
        [
            [
                -8.76709,
                54.457267,
            ],
            [
                -8.76709,
                53.813626,
            ],
            [
                -9.865723,
                53.813626,
            ],
            [
                -9.865723,
                54.457267,
            ],
            [
                -8.76709,
                54.457267,
            ],
        ],
    ]


def test_cannot_transfer_shape_to_line(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    polygons = page.locator(".leaflet-overlay-pane path")
    expect(polygons).to_have_count(0)
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 150, "y": 100})
    map.click(position={"x": 150, "y": 150})
    map.click(position={"x": 100, "y": 150})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(polygons).to_have_count(1)
    extract_button = page.get_by_role(
        "button", name="Extract shape to separate feature"
    )
    polygons.first.click(position={"x": 20, "y": 20}, button="right")
    expect(extract_button).to_be_hidden()
    page.get_by_title("Draw a polyline").click()
    map.click(position={"x": 200, "y": 250})
    map.click(position={"x": 200, "y": 200})
    # Click again to finish
    map.click(position={"x": 200, "y": 200})
    expect(polygons).to_have_count(2)
    polygons.first.click(position={"x": 20, "y": 20}, button="right")
    expect(extract_button).to_be_hidden()


def test_cannot_transfer_shape_to_marker(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    polygons = page.locator(".leaflet-overlay-pane path")
    expect(polygons).to_have_count(0)
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 150, "y": 100})
    map.click(position={"x": 150, "y": 150})
    map.click(position={"x": 100, "y": 150})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(polygons).to_have_count(1)
    extract_button = page.get_by_role(
        "button", name="Extract shape to separate feature"
    )
    polygons.first.click(position={"x": 20, "y": 20}, button="right")
    expect(extract_button).to_be_hidden()
    page.get_by_title("Draw a marker").click()
    map.click(position={"x": 250, "y": 200})
    expect(polygons).to_have_count(1)
    polygons.first.click(position={"x": 20, "y": 20}, button="right")
    expect(extract_button).to_be_hidden()


def test_can_clone_polygon(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    polygons = page.locator(".leaflet-overlay-pane path")
    expect(polygons).to_have_count(0)
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(polygons).to_have_count(1)
    polygons.first.click(button="right")
    page.get_by_role("button", name="Clone this feature").click()
    expect(polygons).to_have_count(2)
    data = save_and_get_json(page)
    assert len(data["features"]) == 2
    assert data["features"][0]["geometry"]["type"] == "Polygon"
    assert data["features"][0]["geometry"] == data["features"][1]["geometry"]


def test_can_transform_polygon_to_line(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    paths = page.locator(".leaflet-overlay-pane path")
    polygons = page.locator(".leaflet-overlay-pane path[fill='DarkBlue']")
    expect(polygons).to_have_count(0)
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(polygons).to_have_count(1)
    expect(paths).to_have_count(1)
    polygons.first.click(button="right")
    page.get_by_role("button", name="Transform to lines").click()
    # No more polygons (will fill), but one path, it must be a line
    expect(polygons).to_have_count(0)
    expect(paths).to_have_count(1)
    data = save_and_get_json(page)
    assert len(data["features"]) == 1
    assert data["features"][0]["geometry"]["type"] == "LineString"


def test_can_draw_a_polygon_and_invert_it(live_server, page, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    paths = page.locator(".leaflet-overlay-pane path")
    expect(paths).to_have_count(0)
    page.get_by_title("Draw a polygon").click()
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 100})
    map.click(position={"x": 200, "y": 200})
    map.click(position={"x": 100, "y": 200})
    map.click(position={"x": 100, "y": 100})
    # Click again to finish
    map.click(position={"x": 100, "y": 100})
    expect(paths).to_have_count(1)
    page.get_by_text("Advanced properties").click()
    page.get_by_text("Display the polygon inverted").click()
    data = save_and_get_json(page)
    assert len(data["features"]) == 1
    assert data["features"][0]["geometry"]["type"] == "Polygon"
    assert data["features"][0]["geometry"]["coordinates"] == [
        [
            [
                -7.668457,
                54.457267,
            ],
            [
                -7.668457,
                53.159947,
            ],
            [
                -9.865723,
                53.159947,
            ],
            [
                -9.865723,
                54.457267,
            ],
            [
                -7.668457,
                54.457267,
            ],
        ],
    ]

    page.get_by_role("button", name="View").click()
    popup = page.locator(".leaflet-popup")
    expect(popup).to_be_hidden()
    # Now click on the middle of the polygon, it should not show the popup
    map.click(position={"x": 150, "y": 150})
    expect(popup).to_be_hidden()
    # Click elsewhere on the map, it should now show the popup
    map.click(position={"x": 250, "y": 250})
    expect(popup).to_be_visible()


def test_vertexmarker_not_shown_if_too_many(live_server, map, page, settings):
    geojson = '{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[3.350602,48.438077],[3.349287,48.438082],[3.34921,48.438124],[3.348519,48.438108],[3.34546,48.437416],[3.343752,48.436955],[3.339092,48.435705],[3.333756,48.434278],[3.330224,48.433336],[3.326293,48.43229],[3.323154,48.430374],[3.32129,48.429238],[3.321234,48.429191],[3.321164,48.429221],[3.320893,48.429117],[3.320766,48.42912],[3.320575,48.429213],[3.320289,48.429303],[3.320042,48.429427],[3.319659,48.429542],[3.319215,48.429622],[3.318547,48.429691],[3.317845,48.429671],[3.317751,48.429698],[3.316503,48.430404],[3.316247,48.430481],[3.316101,48.431152],[3.316181,48.431164],[3.315466,48.432852],[3.315229,48.432981],[3.314785,48.433076],[3.314588,48.432699],[3.314474,48.432376],[3.314197,48.431965],[3.313812,48.431626],[3.313264,48.431253],[3.312393,48.430865],[3.311687,48.43069],[3.311471,48.430693],[3.311199,48.430622],[3.310632,48.430628],[3.30879,48.430373],[3.307032,48.430298],[3.306597,48.430211],[3.306301,48.430213],[3.306137,48.430161],[3.305651,48.430165],[3.304839,48.430046],[3.303726,48.429803],[3.302861,48.42972],[3.302237,48.429635],[3.300559,48.429488],[3.300396,48.429435],[3.299502,48.429335],[3.298528,48.429198],[3.298176,48.429201],[3.296263,48.429039],[3.296267,48.429307],[3.296237,48.429425],[3.295882,48.429848],[3.295665,48.429789],[3.295397,48.430056],[3.295377,48.430132],[3.295186,48.430421],[3.295198,48.430531],[3.295344,48.430735],[3.296077,48.431333],[3.295938,48.431617],[3.29576,48.43168],[3.294082,48.431442],[3.292288,48.431198],[3.292303,48.431101],[3.29082,48.431007],[3.29043,48.430975],[3.290451,48.431129],[3.290115,48.431105],[3.289097,48.430993],[3.289185,48.430805],[3.288545,48.430699],[3.288311,48.430684],[3.287686,48.430687],[3.287456,48.431129],[3.287465,48.43122],[3.288277,48.431574],[3.28896,48.431915],[3.288937,48.431969],[3.289431,48.432499],[3.289672,48.43292],[3.289871,48.433156],[3.29036,48.433602],[3.290557,48.433724],[3.290781,48.433809],[3.291035,48.433857],[3.291537,48.434024],[3.291819,48.434151],[3.292118,48.434341],[3.292479,48.434677],[3.292929,48.435388],[3.293207,48.435792],[3.293881,48.43672],[3.293762,48.436772],[3.294056,48.437209],[3.294117,48.437385],[3.294618,48.437579],[3.294465,48.437764],[3.294424,48.438087],[3.294357,48.438293],[3.293776,48.438817],[3.293308,48.439323],[3.292929,48.439844],[3.292671,48.440235],[3.29233,48.440924],[3.291807,48.441432],[3.29161,48.441661],[3.291402,48.44196],[3.291265,48.442663],[3.291255,48.442806],[3.291328,48.443126],[3.291407,48.443202],[3.291574,48.443473],[3.292253,48.444495],[3.292329,48.444596],[3.293056,48.445276],[3.293138,48.445309],[3.293368,48.445628],[3.293661,48.445985],[3.29374,48.446117],[3.29396,48.446372],[3.294304,48.446627],[3.294761,48.446912],[3.295881,48.447668],[3.295849,48.447688],[3.296837,48.448338],[3.297547,48.44891],[3.297465,48.44892],[3.297188,48.449195],[3.297597,48.449543],[3.297753,48.449701],[3.297845,48.449851],[3.298264,48.450055],[3.298478,48.450121],[3.298946,48.450221],[3.299309,48.450317],[3.299359,48.450237],[3.300493,48.450461],[3.301087,48.450674],[3.301703,48.45101],[3.301995,48.451197],[3.3024,48.451534],[3.302702,48.45174],[3.303329,48.452007],[3.304029,48.452197],[3.304569,48.452446],[3.304803,48.452502],[3.305096,48.452877],[3.30567,48.453409],[3.305998,48.453617],[3.306329,48.453567],[3.306999,48.453359],[3.307147,48.453453],[3.307452,48.453162],[3.307621,48.452853],[3.307637,48.452428],[3.307707,48.452345],[3.307741,48.452152],[3.307605,48.451823],[3.307551,48.45153],[3.307474,48.451395],[3.307218,48.451316],[3.307069,48.45119],[3.307261,48.450528],[3.307483,48.449868],[3.307603,48.449365],[3.30774,48.448909],[3.307598,48.448808],[3.307761,48.448604],[3.307863,48.447956],[3.307886,48.447645],[3.307972,48.447245],[3.308239,48.446362],[3.308306,48.446042],[3.308487,48.445329],[3.308442,48.444844],[3.308479,48.444713],[3.308967,48.443542],[3.309235,48.442927],[3.309464,48.442289],[3.309372,48.442046],[3.309621,48.441616],[3.310152,48.441065],[3.310213,48.440729],[3.310237,48.440329],[3.310167,48.439906],[3.31076,48.439111],[3.31118,48.438009],[3.311161,48.437961],[3.311906,48.437902],[3.312261,48.437839],[3.312486,48.437744],[3.31306,48.437674],[3.312613,48.438361],[3.312487,48.43883],[3.312493,48.439136],[3.312443,48.439388],[3.312598,48.440393],[3.312739,48.440752],[3.312879,48.440985],[3.313263,48.441305],[3.313916,48.441515],[3.314457,48.441565],[3.315105,48.44156],[3.31581,48.441607],[3.317056,48.441849],[3.318361,48.442198],[3.319041,48.442408],[3.319287,48.442604],[3.319343,48.442711],[3.320216,48.443117],[3.320709,48.443437],[3.32126,48.444007],[3.321788,48.444776],[3.322181,48.445618],[3.322479,48.445616],[3.32283,48.445577],[3.323344,48.445663],[3.324048,48.445693],[3.324695,48.445562],[3.324992,48.445559],[3.325558,48.445482],[3.325963,48.445479],[3.327479,48.445592],[3.327939,48.445678],[3.328502,48.445481],[3.328942,48.445392],[3.329169,48.44538],[3.330112,48.445466],[3.330715,48.445575],[3.330881,48.44557],[3.332155,48.445373],[3.33243,48.445375],[3.332727,48.445438],[3.3332,48.445588],[3.333358,48.445683],[3.333737,48.446027],[3.333998,48.446169],[3.334135,48.446334],[3.334611,48.447294],[3.33488,48.447909],[3.334992,48.447959],[3.335297,48.448013],[3.336516,48.448161],[3.336874,48.44825],[3.337258,48.448531],[3.337442,48.448737],[3.337525,48.448936],[3.337649,48.448967],[3.338263,48.448902],[3.33836,48.44894],[3.338765,48.44921],[3.339281,48.449513],[3.339464,48.449515],[3.339877,48.448856],[3.339867,48.448673],[3.340611,48.447311],[3.341744,48.447535],[3.343846,48.447943],[3.345266,48.448152],[3.345478,48.447345],[3.345816,48.446774],[3.345976,48.446809],[3.346142,48.44657],[3.346,48.446493],[3.346043,48.446099],[3.346047,48.445835],[3.346203,48.44558],[3.34717,48.444977],[3.347471,48.444638],[3.347571,48.444466],[3.347583,48.444183],[3.347678,48.443989],[3.348162,48.443428],[3.348326,48.443259],[3.348351,48.443136],[3.34831,48.442736],[3.348141,48.442484],[3.348246,48.442411],[3.348271,48.442293],[3.348097,48.442202],[3.347875,48.442142],[3.347773,48.441997],[3.34751,48.441531],[3.347394,48.441212],[3.349317,48.441364],[3.349478,48.441055],[3.349528,48.44103],[3.350119,48.441039],[3.350252,48.440793],[3.35052,48.440779],[3.350618,48.440612],[3.35069,48.440129],[3.350806,48.43921],[3.350792,48.439037],[3.350698,48.438594],[3.350566,48.438327],[3.350602,48.438077]]]},"properties":{"nom":"Grisy-sur-Seine","code":"77218","codeDepartement":"77","siren":"217702182","codeEpci":"200040251","codeRegion":"11","codesPostaux":["77480"],"population":107},"id":"g0OTg"}'
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/#15/48.4395/3.3189")
    page.get_by_title("Import data").click()
    page.locator(".umap-upload textarea").fill(geojson)
    page.locator('select[name="format"]').select_option("geojson")
    page.get_by_role("button", name="Import data", exact=True).click()
    page.locator("path").click()
    page.get_by_role("link", name="Toggle edit mode (⇧+Click)").click()
    expect(page.locator("#umap-tooltip-container")).to_contain_text(
        "Please zoom in to edit the geometry"
    )
    expect(page.locator(".leaflet-vertex-icon")).to_be_hidden()
    page.get_by_label("Zoom in").click()
    expect(page.locator("#umap-tooltip-container")).to_contain_text(
        "Please zoom in to edit the geometry"
    )
    page.get_by_label("Zoom in").click()
    page.wait_for_timeout(500)
    page.get_by_label("Zoom out").click()
    page.wait_for_timeout(500)
    expect(page.locator(".leaflet-vertex-icon")).to_be_hidden()
    expect(page.locator("#umap-tooltip-container")).to_contain_text(
        "Please zoom in to edit the geometry"
    )
