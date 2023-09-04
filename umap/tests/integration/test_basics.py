import pytest
from playwright.sync_api import expect


def test_page_title(page, live_server):
    page.goto(live_server.url)
    expect(page).to_have_title("uMap")


@pytest.mark.parametrize(
    "lang,link_name,link_url",
    [("fr", "Créer une carte", "/fr/map/new/"), ("en", "Create a map", "/en/map/new/")],
)
def test_create_map_link(page, live_server, lang, link_name, link_url):
    page.goto(f"{live_server.url}/{lang}/")
    create_map_button = page.locator("header nav a.button")
    expect(create_map_button).to_have_text(link_name)
    expect(create_map_button).to_have_attribute("href", link_url)


def test_create_map_with_cursor(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Click on the Draw a marker button on a new map.
    create_marker_link = page.locator(".leaflet-control-toolbar ").get_by_title(
        "Draw a marker"
    )
    expect(create_marker_link).to_have_attribute("href", "#")
    create_marker_link.click()

    # Check no marker is present by default.
    marker_pane_children = page.locator(".leaflet-marker-pane > div")
    expect(marker_pane_children).to_have_count(0)

    # Click on the map, it will place a marker at the given position.
    map = page.locator("#map")
    map.click(position={"x": 200, "y": 200})
    expect(marker_pane_children).to_have_count(1)
    expect(marker_pane_children).to_have_attribute(
        "style",
        (
            "margin-left: -16px; "
            "margin-top: -40px; "
            "transform: translate3d(200px, 200px, 0px); "
            "z-index: 200;"
        ),
    )
