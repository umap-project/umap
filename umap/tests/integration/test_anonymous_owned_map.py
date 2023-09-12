import pytest
from django.core.signing import get_cookie_signer
from playwright.sync_api import expect

from umap.models import DataLayer

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("allow_anonymous")]


@pytest.fixture
def owner_session(anonymap, context, live_server):
    key, value = anonymap.signed_cookie_elements
    signed = get_cookie_signer(salt=key).sign(value)
    context.add_cookies([{"name": key, "value": signed, "url": live_server.url}])
    return context.new_page()


def test_map_load_with_owner(anonymap, live_server, owner_session):
    owner_session.goto(f"{live_server.url}{anonymap.get_absolute_url()}")
    map_el = owner_session.locator("#map")
    expect(map_el).to_be_visible()
    enable = owner_session.get_by_role("link", name="Edit")
    expect(enable).to_be_visible()
    enable.click()
    disable = owner_session.get_by_role("link", name="Disable editing")
    expect(disable).to_be_visible()
    save = owner_session.get_by_title("Save current edits (Ctrl+S)")
    expect(save).to_be_visible()
    add_marker = owner_session.get_by_title("Draw a marker")
    expect(add_marker).to_be_visible()
    edit_settings = owner_session.get_by_title("Edit map settings")
    expect(edit_settings).to_be_visible()
    edit_permissions = owner_session.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_visible()


def test_map_load_with_anonymous(anonymap, live_server, page):
    page.goto(f"{live_server.url}{anonymap.get_absolute_url()}")
    map_el = page.locator("#map")
    expect(map_el).to_be_visible()
    enable = page.get_by_role("link", name="Edit")
    expect(enable).to_be_hidden()


def test_map_load_with_anonymous_but_editable_layer(
    anonymap, live_server, page, datalayer
):
    datalayer.edit_status = DataLayer.ANONYMOUS
    datalayer.save()
    page.goto(f"{live_server.url}{anonymap.get_absolute_url()}")
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
    expect(edit_settings).to_be_hidden()
    edit_permissions = page.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_hidden()


def test_owner_permissions_form(map, datalayer, live_server, owner_session):
    owner_session.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    edit_permissions = owner_session.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_visible()
    edit_permissions.click()
    select = owner_session.locator(".umap-field-share_status select")
    expect(select).to_be_hidden()
    # expect(select).to_have_value(Map.PUBLIC)  # Does not work
    owner_field = owner_session.locator(".umap-field-owner")
    expect(owner_field).to_be_hidden()
    editors_field = owner_session.locator(".umap-field-editors input")
    expect(editors_field).to_be_hidden()
    datalayer_label = owner_session.get_by_text('Who can edit "Donau"')
    expect(datalayer_label).to_be_visible()
