import re

import pytest
from playwright.sync_api import expect

from umap.models import Map


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


def test_cannot_put_script_tag_in_datalayer_name_or_description(
    openmap, live_server, page, tilelayer
):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}")
    page.get_by_role("button", name="Edit").click()
    page.get_by_role("link", name="Manage layers").click()
    page.get_by_role("button", name="Add a layer").click()
    page.locator('input[name="name"]').click()
    page.locator('input[name="name"]').fill('<script>alert("attack")</script>')
    page.locator(".umap-field-description textarea").click()
    page.locator(".umap-field-description textarea").fill(
        '<p>before <script>alert("attack")</script> after</p>'
    )
    page.get_by_role("button", name="Save").click()
    page.get_by_role("button", name="About").click()
    # Title should contain raw HTML (we are using textContent)
    expect(page.get_by_text('<script>alert("attack")</script>')).to_be_visible()
    # Description should contain escaped HTML
    expect(page.get_by_text("before after")).to_be_visible()


def test_login_from_map_page(live_server, page, tilelayer, settings, user, context):
    settings.ENABLE_ACCOUNT_LOGIN = True
    assert Map.objects.count() == 0
    page.goto(f"{live_server.url}/en/map/new/")
    with (
        page.expect_response(re.compile(r".*/map/create/")),
        context.expect_page() as login_page_info,
    ):
        page.get_by_role("button", name="Save").click()
    assert Map.objects.count() == 0
    login_page = login_page_info.value
    expect(login_page).to_have_title("Login")
    login_page.get_by_placeholder("Username").fill(user.username)
    login_page.get_by_placeholder("Password").fill("123123")
    with page.expect_response(re.compile(r".*/map/create/")):
        login_page.locator('#login_form input[type="submit"]').click()
    # Login page should be closed
    page.wait_for_timeout(500)  # Seems needed from time to time…
    assert len(context.pages) == 1
    # Save should have proceed
    assert Map.objects.count() == 1
    # Use name should now appear on the header toolbar
    expect(page.get_by_role("button", name="Joe")).to_be_visible()
