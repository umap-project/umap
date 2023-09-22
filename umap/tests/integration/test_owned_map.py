from time import sleep

import pytest
from playwright.sync_api import expect

from umap.models import DataLayer, Map

pytestmark = pytest.mark.django_db


@pytest.fixture
def login(context, settings, live_server):
    def do_login(user):
        # TODO use storage state to do login only once per session
        # https://playwright.dev/python/docs/auth
        settings.ENABLE_ACCOUNT_LOGIN = True
        page = context.new_page()
        page.goto(f"{live_server.url}/en/")
        page.locator(".login").click()
        page.get_by_placeholder("Username").fill(user.username)
        page.get_by_placeholder("Password").fill("123123")
        page.locator('#login_form input[type="submit"]').click()
        sleep(1)  # Time for ajax login POST to proceed
        return page

    return do_login


def test_map_update_with_owner(map, live_server, login):
    page = login(map.owner)
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
    page = login(map.owner)
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
    datalayer_label = page.get_by_text('Who can edit "test datalayer"')
    expect(datalayer_label).to_be_visible()
    options = page.locator(".datalayer-permissions select[name='edit_status'] option")
    expect(options).to_have_count(4)
    option = page.locator(
        ".datalayer-permissions select[name='edit_status'] option:checked"
    )
    expect(option).to_have_text("Inherit")


def test_map_update_with_editor(map, live_server, login, user):
    map.edit_status = Map.EDITORS
    map.editors.add(user)
    map.save()
    page = login(user)
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


def test_permissions_form_with_editor(map, datalayer, live_server, login, user):
    map.edit_status = Map.EDITORS
    map.editors.add(user)
    map.save()
    page = login(user)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    edit_permissions = page.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_visible()
    edit_permissions.click()
    select = page.locator(".umap-field-share_status select")
    expect(select).to_be_hidden()
    # expect(select).to_have_value(Map.PUBLIC)  # Does not work
    owner_field = page.locator(".umap-field-owner")
    expect(owner_field).to_be_hidden()
    editors_field = page.locator(".umap-field-editors input")
    expect(editors_field).to_be_visible()
    datalayer_label = page.get_by_text('Who can edit "test datalayer"')
    expect(datalayer_label).to_be_visible()


def test_owner_has_delete_map_button(map, live_server, login):
    page = login(map.owner)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    settings = page.get_by_title("Edit map settings")
    expect(settings).to_be_visible()
    settings.click()
    advanced = page.get_by_text("Advanced actions")
    expect(advanced).to_be_visible()
    advanced.click()
    delete = page.get_by_role("link", name="Delete")
    expect(delete).to_be_visible()


def test_editor_do_not_have_delete_map_button(map, live_server, login, user):
    map.edit_status = Map.EDITORS
    map.editors.add(user)
    map.save()
    page = login(user)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    settings = page.get_by_title("Edit map settings")
    expect(settings).to_be_visible()
    settings.click()
    advanced = page.get_by_text("Advanced actions")
    expect(advanced).to_be_visible()
    advanced.click()
    delete = page.get_by_role("link", name="Delete")
    expect(delete).to_be_hidden()


def test_create(tilelayer, live_server, login, user):
    page = login(user)
    page.goto(f"{live_server.url}/en/map/new")
    add_marker = page.get_by_title("Draw a marker")
    map_el = page.locator("#map")
    expect(add_marker).to_be_visible()
    marker = page.locator(".leaflet-marker-icon")
    expect(marker).to_have_count(0)
    add_marker.click()
    map_el.click(position={"x": 100, "y": 100})
    expect(marker).to_have_count(1)
    save = page.get_by_title("Save current edits")
    expect(save).to_be_visible()
    save.click()
    sleep(1)  # Let save ajax go back
    expect(marker).to_have_count(1)


def test_can_change_perms_after_create(tilelayer, live_server, login, user):
    page = login(user)
    page.goto(f"{live_server.url}/en/map/new")
    save = page.get_by_title("Save current edits")
    expect(save).to_be_visible()
    save.click()
    sleep(1)  # Let save ajax go back
    edit_permissions = page.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_visible()
    edit_permissions.click()
    select = page.locator(".umap-field-share_status select")
    expect(select).to_be_visible()
    option = page.locator("select[name='share_status'] option:checked")
    expect(option).to_have_text("Everyone (public)")
    owner_field = page.locator(".umap-field-owner")
    expect(owner_field).to_be_visible()
    editors_field = page.locator(".umap-field-editors input")
    expect(editors_field).to_be_visible()
    datalayer_label = page.get_by_text('Who can edit "Layer 1"')
    expect(datalayer_label).to_be_visible()
    options = page.locator(".datalayer-permissions select[name='edit_status'] option")
    expect(options).to_have_count(4)
    option = page.locator(
        ".datalayer-permissions select[name='edit_status'] option:checked"
    )
    expect(option).to_have_text("Inherit")


def test_can_change_owner(map, live_server, login, user):
    page = login(map.owner)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    edit_permissions = page.get_by_title("Update permissions and editors")
    edit_permissions.click()
    close = page.locator(".umap-field-owner .close")
    close.click()
    input = page.locator("input.edit-owner")
    input.type(user.username)
    input.press("Tab")
    save = page.get_by_title("Save current edits")
    expect(save).to_be_visible()
    save.click()
    sleep(1)  # Let save ajax go
    modified = Map.objects.get(pk=map.pk)
    assert modified.owner == user
