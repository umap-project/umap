from time import sleep

import pytest
from playwright.sync_api import expect

from umap.models import DataLayer

pytestmark = pytest.mark.django_db


@pytest.fixture
def login(context, user, settings, live_server):
    def do_login(username):
        # TODO use storage state to do login only once per session
        # https://playwright.dev/python/docs/auth
        settings.ENABLE_ACCOUNT_LOGIN = True
        page = context.new_page()
        page.goto(f"{live_server.url}/en/")
        page.locator(".login").click()
        page.get_by_placeholder("Username").fill(username)
        page.get_by_placeholder("Password").fill("123123")
        page.locator('#login_form input[type="submit"]').click()
        sleep(1)  # Time for ajax login POST to proceed
        return page

    return do_login


def test_map_update_with_owner(map, live_server, login):
    page = login(map.owner.username)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    map_el = page.locator("#map")
    expect(map_el).to_be_visible()
    enable = page.get_by_role("link", name="Edit")
    expect(enable).to_be_visible()
    enable.click()
    disable = page.get_by_role("link", name="Disable editing")
    expect(disable).to_be_visible()
    save = page.get_by_title("Save current edits (Ctrl+S)")
    expect(save).to_be_visible()
    add_marker = page.get_by_title("Draw a marker")
    expect(add_marker).to_be_visible()
    edit_settings = page.get_by_title("Edit map settings")
    expect(edit_settings).to_be_visible()
    edit_permissions = page.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_visible()


def test_map_update_with_anonymous(map, live_server, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    map_el = page.locator("#map")
    expect(map_el).to_be_visible()
    enable = page.get_by_role("link", name="Edit")
    expect(enable).to_be_hidden()


def test_map_update_with_anonymous_but_editable_datalayer(
    map, datalayer, live_server, page
):
    datalayer.edit_status = DataLayer.ANONYMOUS
    datalayer.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    map_el = page.locator("#map")
    expect(map_el).to_be_visible()
    enable = page.get_by_role("link", name="Edit")
    expect(enable).to_be_visible()
    enable.click()
    add_marker = page.get_by_title("Draw a marker")
    expect(add_marker).to_be_visible()
    edit_settings = page.get_by_title("Edit map settings")
    expect(edit_settings).to_be_hidden()
    edit_permissions = page.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_hidden()


def test_owner_permissions_form(map, datalayer, live_server, login):
    page = login(map.owner.username)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    edit_permissions = page.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_visible()
    edit_permissions.click()
    select = page.locator(".umap-field-share_status select")
    expect(select).to_be_visible()
    # expect(select).to_have_value(Map.PUBLIC)  # Does not work
    owner_field = page.locator(".umap-field-owner")
    expect(owner_field).to_be_visible()
    editors_field = page.locator(".umap-field-editors input")
    expect(editors_field).to_be_visible()
    datalayer_label = page.get_by_text('Who can edit "Donau"')
    expect(datalayer_label).to_be_visible()


def test_map_update_with_editor(map, live_server, login, user):
    map.editors.add(user)
    map.save()
    page = login(user.username)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    map_el = page.locator("#map")
    expect(map_el).to_be_visible()
    enable = page.get_by_role("link", name="Edit")
    expect(enable).to_be_visible()
    enable.click()
    disable = page.get_by_role("link", name="Disable editing")
    expect(disable).to_be_visible()
    save = page.get_by_title("Save current edits (Ctrl+S)")
    expect(save).to_be_visible()
    add_marker = page.get_by_title("Draw a marker")
    expect(add_marker).to_be_visible()
    edit_settings = page.get_by_title("Edit map settings")
    expect(edit_settings).to_be_visible()
    edit_permissions = page.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_visible()
