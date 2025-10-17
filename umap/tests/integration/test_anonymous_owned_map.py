import re
from smtplib import SMTPException
from unittest.mock import patch

import pytest
from django.core.signing import get_cookie_signer
from playwright.sync_api import expect

from umap.models import DataLayer, Map

from ..base import DataLayerFactory

pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("allow_anonymous")]


@pytest.fixture
def owner_session(anonymap, context, live_server):
    key, value = anonymap.signed_cookie_elements
    signed = get_cookie_signer(salt=key).sign(value)
    context.add_cookies([{"name": key, "value": signed, "url": live_server.url}])


def test_map_load_with_owner(anonymap, live_server, owner_session, page):
    page.goto(f"{live_server.url}{anonymap.get_absolute_url()}")
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
    expect(edit_settings).to_be_hidden()
    edit_permissions = page.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_hidden()


def test_owner_permissions_form(map, datalayer, live_server, owner_session, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    edit_permissions = page.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_visible()
    edit_permissions.click()
    owner_field = page.locator(".umap-field-owner")
    expect(owner_field).to_be_hidden()
    editors_field = page.locator(".umap-field-editors input")
    expect(editors_field).to_be_hidden()
    datalayer_label = page.get_by_text('Who can edit "test datalayer"')
    expect(datalayer_label).to_be_visible()
    options = page.locator(".datalayer-permissions select[name='edit_status'] option")
    expect(options).to_have_count(3)
    option = page.locator(
        ".datalayer-permissions select[name='edit_status'] option:checked"
    )
    expect(option).to_have_text("Inherit")
    expect(page.locator(".umap-field-share_status select")).to_be_visible()
    options = [
        int(option.get_attribute("value"))
        for option in page.locator(".umap-field-share_status select option").all()
    ]
    assert options == [Map.DRAFT, Map.PUBLIC]
    # This field should not be present in anonymous maps
    expect(page.locator(".umap-field-owner")).to_be_hidden()


def test_anonymous_can_add_marker_on_editable_layer(
    anonymap, datalayer, live_server, page
):
    datalayer.edit_status = DataLayer.OWNER
    datalayer.name = "Should not be in the select"
    datalayer.save()  # Non editable by anonymous users
    assert datalayer.map == anonymap
    other = DataLayerFactory(
        map=anonymap, edit_status=DataLayer.ANONYMOUS, name="Editable"
    )
    assert other.map == anonymap
    page.goto(f"{live_server.url}{anonymap.get_absolute_url()}?edit")
    add_marker = page.get_by_title("Draw a marker")
    expect(add_marker).to_be_visible()
    marker = page.locator(".leaflet-marker-icon")
    map_el = page.locator("#map")
    expect(marker).to_have_count(2)
    panel = page.locator(".panel.right.on")
    expect(panel).to_be_hidden()
    add_marker.click()
    map_el.click(position={"x": 100, "y": 100})
    expect(marker).to_have_count(3)
    # Edit panel is open
    expect(panel).to_be_visible()
    datalayer_select = page.locator("select[name='datalayer']")
    expect(datalayer_select).to_be_visible()
    options = page.locator("select[name='datalayer'] option")
    expect(options).to_have_count(1)  # Only Editable layer should be listed
    option = page.locator("select[name='datalayer'] option:checked")
    expect(option).to_have_text(other.name)


def test_can_change_perms_after_create(tilelayer, live_server, page):
    page.goto(f"{live_server.url}/en/map/new")
    # Create a layer
    page.get_by_title("Manage layers").click()
    page.get_by_title("Add a layer").click()
    page.locator("input[name=name]").fill("Layer 1")
    expect(
        page.get_by_role("button", name="Visibility: Draft (private)")
    ).to_be_visible()
    expect(page.get_by_role("button", name="Save", exact=True)).to_be_hidden()
    with page.expect_response(re.compile(r".*/datalayer/create/.*")):
        page.get_by_role("button", name="Save draft", exact=True).click()
    edit_permissions = page.get_by_title("Update permissions and editors")
    expect(edit_permissions).to_be_visible()
    edit_permissions.click()
    owner_field = page.locator(".umap-field-owner")
    expect(owner_field).to_be_hidden()
    editors_field = page.locator(".umap-field-editors input")
    expect(editors_field).to_be_hidden()
    datalayer_label = page.get_by_text('Who can edit "Layer 1"')
    expect(datalayer_label).to_be_visible()
    options = page.locator(".datalayer-permissions select[name='edit_status'] option")
    expect(options).to_have_count(3)
    option = page.locator(
        ".datalayer-permissions select[name='edit_status'] option:checked"
    )
    expect(option).to_have_text("Inherit")
    expect(page.get_by_label("Secret edit link:")).to_be_visible()
    page.locator('select[name="share_status"]').select_option("1")
    expect(page.get_by_role("button", name="Save draft", exact=True)).to_be_hidden()
    expect(page.get_by_role("button", name="Save", exact=True)).to_be_visible()


def test_alert_message_after_create(
    tilelayer, live_server, page, monkeypatch, settings
):
    page.goto(f"{live_server.url}/en/map/new")
    save = page.get_by_role("button", name="Save")
    expect(save).to_be_visible()
    alert = page.locator('umap-alert-creation div[role="dialog"]')
    expect(alert).to_be_hidden()
    with page.expect_response(re.compile(r".*/map/create/")):
        save.click()
    new_map = Map.objects.last()
    expect(alert).to_be_visible()
    expect(
        alert.get_by_text("Hey, you created a map without an account!")
    ).to_be_visible()
    expect(alert.get_by_role("button", name="Copy")).to_be_visible()
    expect(alert.get_by_role("button", name="Send me the link")).to_be_visible()
    alert.get_by_placeholder("Email").fill("foo@bar.com")
    with patch("umap.views.send_mail") as patched:
        with page.expect_response(re.compile("/en/map/.*/send-edit-link/")):
            alert.get_by_role("button", name="Send me the link").click()
        assert patched.called
        patched.assert_called_with(
            "The uMap edit link for your map: Untitled map",
            f"Here is your secret edit link: {new_map.get_anonymous_edit_url()}",
            "test@test.org",
            ["foo@bar.com"],
            fail_silently=False,
        )


def test_email_sending_error_are_caught(tilelayer, page, live_server):
    page.goto(f"{live_server.url}/en/map/new")
    alert_creation = page.locator('umap-alert-creation div[role="dialog"]')
    with page.expect_response(re.compile(r".*/map/create/")):
        page.get_by_role("button", name="Save").click()
    alert_creation.get_by_placeholder("Email").fill("foo@bar.com")
    with patch("umap.views.send_mail", side_effect=SMTPException) as patched:
        with page.expect_response(re.compile("/en/map/.*/send-edit-link/")):
            alert_creation.get_by_role("button", name="Send me the link").click()
        assert patched.called
        alert = page.locator('umap-alert div[role="dialog"]')
        expect(alert.get_by_text("Can't send email to foo@bar.com")).to_be_visible()


@pytest.mark.skip(reason="Changing DEFAULT_FROM_EMAIL at runtime has no effect")
def test_alert_message_after_create_show_link_even_without_mail(
    tilelayer, live_server, page, monkeypatch, settings
):
    # Disable email
    settings.DEFAULT_FROM_EMAIL = None
    page.goto(f"{live_server.url}/en/map/new")
    with page.expect_response(re.compile(r".*/map/create/")):
        page.get_by_role("button", name="Save").click()
    alert = page.locator('umap-alert-creation div[role="dialog"]')
    expect(alert).to_be_visible()
    expect(
        alert.get_by_text("Hey, you created a map without an account!")
    ).to_be_visible()
    expect(alert.get_by_role("button", name="Copy")).to_be_visible()
    expect(alert.get_by_role("button", name="Send me the link")).to_be_hidden()


def test_anonymous_owner_can_delete_the_map(anonymap, live_server, owner_session, page):
    assert Map.objects.count() == 1
    page.goto(f"{live_server.url}{anonymap.get_absolute_url()}")
    page.get_by_role("button", name="Edit").click()
    page.get_by_role("button", name="Map advanced properties").click()
    page.get_by_text("Advanced actions").click()
    expect(page.get_by_role("button", name="Delete")).to_be_visible()
    page.get_by_role("button", name="Delete").click()
    with page.expect_response(re.compile(r".*/update/delete/.*")):
        page.get_by_role("button", name="OK").click()
    assert Map.objects.get(pk=anonymap.pk).share_status == Map.DELETED


def test_non_owner_cannot_see_delete_button(anonymap, live_server, page):
    anonymap.edit_status = Map.ANONYMOUS
    anonymap.save()
    page.goto(f"{live_server.url}{anonymap.get_absolute_url()}")
    page.get_by_role("button", name="Edit").click()
    page.get_by_role("button", name="Map advanced properties").click()
    page.get_by_text("Advanced actions").click()
    expect(page.get_by_role("button", name="Delete")).to_be_hidden()


def test_logged_in_user_should_have_a_message_to_attach_map(
    anonymap, live_server, login, user, page, owner_session
):
    page.goto(f"{live_server.url}{anonymap.get_absolute_url()}")
    page.get_by_role("button", name="Edit").click()
    expect(
        page.get_by_text(
            "This map is anonymous, do you want to attach it to your account?"
        )
    ).to_be_hidden()

    page = login(user)
    page.goto(f"{live_server.url}{anonymap.get_absolute_url()}")
    page.get_by_role("button", name="Edit").click()
    expect(
        page.get_by_text(
            "This map is anonymous, do you want to attach it to your account?"
        )
    ).to_be_visible()
    with page.expect_response(re.compile(r".*/update/owner/.*")):
        page.get_by_role("button", name="OK").click()
    saved = Map.objects.get(pk=anonymap.pk)
    assert saved.owner


def test_can_attach_map_after_save(
    live_server, user, page, tilelayer, context, settings
):
    settings.ENABLE_ACCOUNT_LOGIN = True
    page.goto(f"{live_server.url}/en/map/new")
    expect(page.get_by_role("button", name="Anonymous")).to_be_visible()
    expect(page.get_by_role("button", name="Visibility: Draft")).to_have_class(
        re.compile(r".*anonymous.*")
    )
    assert not Map.objects.count()
    with page.expect_response(re.compile(r".*/map/create/")):
        page.get_by_role("button", name="Save draft", exact=True).click()
    assert Map.objects.count() == 1
    saved = Map.objects.last()
    assert not saved.owner
    with context.expect_page() as login_page_info:
        page.get_by_role("link", name="log in").click()
    login_page = login_page_info.value
    expect(login_page).to_have_title("Login - Online map creator")
    login_page.get_by_placeholder("Username").fill(user.username)
    login_page.get_by_placeholder("Password").fill("123123")
    with page.expect_response(re.compile(r".*/update/owner/")):
        login_page.locator('#login_form input[type="submit"]').click()
    expect(page.get_by_text("Map has been attached to your account")).to_be_visible()
    saved = Map.objects.last()
    assert saved.owner == user
    expect(page.get_by_role("button", name="Anonymous")).to_be_hidden()
    expect(page.get_by_role("button", name=user.username)).to_be_visible()
    expect(page.get_by_role("button", name="Visibility: Draft")).not_to_have_class(
        re.compile(r".*anonymous.*")
    )
