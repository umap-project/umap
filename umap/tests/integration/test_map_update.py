from time import sleep

import pytest
from playwright.sync_api import expect

from umap.models import Map

pytestmark = pytest.mark.django_db


@pytest.fixture
def loggedin_page(context, user, settings, live_server):
    settings.ENABLE_ACCOUNT_LOGIN = True
    page = context.new_page()
    page.goto(f"{live_server.url}/en/")
    page.locator(".login").click()
    page.get_by_placeholder("Username").fill("Gabriel")
    page.get_by_placeholder("Password").fill("123123")
    page.locator('#login_form input[type="submit"]').click()
    sleep(1)  # Time for ajax login POST to proceed
    return page


def test_map_update_with_owner(map, live_server, loggedin_page):
    loggedin_page.goto(f"{live_server.url}{map.get_absolute_url()}")
    map_el = loggedin_page.locator("#map")
    expect(map_el).to_be_visible()
    enable = loggedin_page.get_by_role("link", name="Edit")
    expect(enable).to_be_visible()
    enable.click()
    disable = loggedin_page.get_by_role("link", name="Disable editing")
    expect(disable).to_be_visible()
    save = loggedin_page.get_by_title("Save current edits (Ctrl+S)")
    expect(save).to_be_visible()
    add_marker = loggedin_page.get_by_title("Draw a marker")
    expect(add_marker).to_be_visible()
    edit_settings = loggedin_page.get_by_title("Edit map settings")
    expect(edit_settings).to_be_visible()
    edit_permissions = loggedin_page.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_visible()


def test_map_update_with_anonymous(map, live_server, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    map_el = page.locator("#map")
    expect(map_el).to_be_visible()
    enable = page.get_by_role("link", name="Edit")
    expect(enable).to_be_hidden()


def test_owner_permissions_form(map, datalayer, live_server, loggedin_page):
    loggedin_page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    edit_permissions = loggedin_page.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_visible()
    edit_permissions.click()
    select = loggedin_page.locator(".umap-field-share_status select")
    expect(select).to_be_visible()
    # expect(select).to_have_value(Map.PUBLIC)  # Does not work
    owner_field = loggedin_page.locator(".umap-field-owner")
    expect(owner_field).to_be_visible()
    editors_field = loggedin_page.locator(".umap-field-editors input")
    expect(editors_field).to_be_visible()
    datalayer_label = loggedin_page.get_by_text('Who can edit "Donau"')
    expect(datalayer_label).to_be_visible()
