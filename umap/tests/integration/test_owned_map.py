import re

import pytest
from playwright.sync_api import expect

from umap.models import DataLayer, Map

pytestmark = pytest.mark.django_db


def test_map_update_with_owner(map, live_server, login):
    page = login(map.owner)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    map_el = page.locator("#map")
    expect(map_el).to_be_visible()
    enable = page.get_by_role("button", name="Edit")
    expect(enable).to_be_visible()
    enable.click()
    disable = page.get_by_role("button", name="View")
    expect(disable).to_be_visible()
    save = page.get_by_role("button", name="Save")
    expect(save).to_be_visible()
    add_marker = page.get_by_title("Draw a marker")
    expect(add_marker).to_be_visible()
    edit_settings = page.get_by_title("Map advanced properties")
    expect(edit_settings).to_be_visible()
    edit_permissions = page.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_visible()


def test_map_update_with_anonymous(map, live_server, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    map_el = page.locator("#map")
    expect(map_el).to_be_visible()
    enable = page.get_by_role("button", name="Edit")
    expect(enable).to_be_hidden()


def test_map_update_with_anonymous_but_editable_datalayer(
    map, datalayer, live_server, page
):
    datalayer.edit_status = DataLayer.ANONYMOUS
    datalayer.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    map_el = page.locator("#map")
    expect(map_el).to_be_visible()
    enable = page.get_by_role("button", name="Edit")
    expect(enable).to_be_visible()
    enable.click()
    add_marker = page.get_by_title("Draw a marker")
    expect(add_marker).to_be_visible()
    edit_settings = page.get_by_title("Map advanced properties")
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
    # Should have been removed since page load
    assert "edit" not in page.url


def test_map_update_with_editor(map, live_server, login, user):
    map.edit_status = Map.COLLABORATORS
    map.editors.add(user)
    map.save()
    page = login(user)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    map_el = page.locator("#map")
    expect(map_el).to_be_visible()
    enable = page.get_by_role("button", name="Edit")
    expect(enable).to_be_visible()
    enable.click()
    disable = page.get_by_role("button", name="View")
    expect(disable).to_be_visible()
    save = page.get_by_role("button", name="Save")
    expect(save).to_be_visible()
    add_marker = page.get_by_title("Draw a marker")
    expect(add_marker).to_be_visible()
    edit_settings = page.get_by_title("Map advanced properties")
    expect(edit_settings).to_be_visible()
    edit_permissions = page.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_visible()


def test_permissions_form_with_editor(map, datalayer, live_server, login, user):
    map.edit_status = Map.COLLABORATORS
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
    settings = page.get_by_title("Map advanced properties")
    expect(settings).to_be_visible()
    settings.click()
    advanced = page.get_by_text("Advanced actions")
    expect(advanced).to_be_visible()
    advanced.click()
    delete = page.get_by_role("button", name="Delete", exact=True)
    expect(delete).to_be_visible()
    delete.click()
    with page.expect_navigation():
        page.get_by_role("button", name="OK").click()
    assert Map.objects.all().count() == 0


def test_editor_do_not_have_delete_map_button(map, live_server, login, user):
    map.edit_status = Map.COLLABORATORS
    map.editors.add(user)
    map.save()
    page = login(user)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    settings = page.get_by_title("Map advanced properties")
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
    save = page.get_by_role("button", name="Save")
    expect(save).to_be_visible()
    with page.expect_response(re.compile(r".*/datalayer/create/")):
        save.click()
    expect(marker).to_have_count(1)


def test_can_change_perms_after_create(tilelayer, live_server, login, user):
    page = login(user)
    page.goto(f"{live_server.url}/en/map/new")
    # Create a layer
    page.get_by_title("Manage layers").click()
    page.get_by_title("Add a layer").click()
    page.locator("input[name=name]").fill("Layer 1")
    save = page.get_by_role("button", name="Save")
    expect(save).to_be_visible()
    with page.expect_response(re.compile(r".*/map/create/")):
        save.click()
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
    with page.expect_response(re.compile(r".*/agnocomplete/.*")):
        input.type(user.username)
    input.press("Tab")
    save = page.get_by_role("button", name="Save")
    expect(save).to_be_visible()
    with page.expect_response(re.compile(r".*/update/permissions/.*")):
        save.click()
    modified = Map.objects.get(pk=map.pk)
    assert modified.owner == user


def test_can_delete_datalayer(live_server, map, login, datalayer):
    page = login(map.owner)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    page.get_by_title("Open browser").click()
    layers = page.locator(".umap-browser .datalayer")
    markers = page.locator(".leaflet-marker-icon")
    expect(layers).to_have_count(1)
    expect(markers).to_have_count(1)
    page.get_by_role("link", name="Manage layers").click()
    page.locator(".panel.right").get_by_title("Delete layer").click()
    page.get_by_role("button", name="OK").click()
    with page.expect_response(re.compile(r".*/datalayer/delete/.*")):
        page.get_by_role("button", name="Save").click()
    expect(markers).to_have_count(0)
    # FIXME does not work, resolve to 1 element, even if this command is empty:
    expect(layers).to_have_count(0)


def test_can_set_team(map, live_server, login, team):
    map.owner.teams.add(team)
    map.owner.save()
    page = login(map.owner)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    edit_permissions = page.get_by_title("Update permissions and editors")
    edit_permissions.click()
    page.locator("select[name=team]").select_option(str(team.pk))
    save = page.get_by_role("button", name="Save")
    expect(save).to_be_visible()
    with page.expect_response(re.compile(r".*/update/permissions/.*")):
        save.click()
    modified = Map.objects.get(pk=map.pk)
    assert modified.team == team
