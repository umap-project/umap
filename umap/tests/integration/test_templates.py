import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.django_db


def test_reuse_template_button(map, datalayer, page, live_server, context):
    map.is_template = True
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page.get_by_text("Reuse this template")).to_be_visible()
    with context.expect_page() as new_page_info:
        page.get_by_text("Reuse this template").click()
    new_page = new_page_info.value
    expect(new_page.get_by_text("Reuse this template")).to_be_hidden()
    expect(page.locator(".leaflet-marker-icon")).to_have_count(1)


def test_load_template_from_panel(map, datalayer, page, live_server):
    map.name = "My Great Template"
    map.is_template = True
    map.save()
    page.goto(f"{live_server.url}/en/map/new")
    page.get_by_title("Load template").click()
    page.get_by_role("button", name="From community").click()
    page.get_by_label("My Great Template").check()
    page.get_by_role("button", name="Load template with data").click()
    expect(page.get_by_text("My Great Template")).to_be_visible()
    expect(page.locator(".leaflet-marker-icon")).to_have_count(1)


def test_load_template_without_data(map, datalayer, page, live_server):
    map.name = "My Great Template"
    map.is_template = True
    map.save()
    page.goto(f"{live_server.url}/en/map/new")
    page.get_by_title("Load template").click()
    page.get_by_role("button", name="From community").click()
    page.get_by_label("My Great Template").check()
    page.locator(".panel").get_by_role(
        "button", name="Load template", exact=True
    ).click()
    expect(page.get_by_text("My Great Template")).to_be_visible()
    expect(page.locator(".leaflet-marker-icon")).to_have_count(0)
