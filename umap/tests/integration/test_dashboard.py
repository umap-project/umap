import pytest
from playwright.sync_api import expect

from umap.models import Map

pytestmark = pytest.mark.django_db


def test_owner_can_delete_map_after_confirmation(map, live_server, login):
    dialog_shown = False

    def handle_dialog(dialog):
        dialog.accept()
        nonlocal dialog_shown
        dialog_shown = True

    page = login(map.owner)
    page.goto(f"{live_server.url}/en/me")
    delete_button = page.get_by_title("Delete")
    expect(delete_button).to_be_visible()
    page.on("dialog", handle_dialog)
    with page.expect_navigation():
        delete_button.click()
    assert dialog_shown
    assert Map.objects.get(pk=map.pk).share_status == Map.DELETED


def test_dashboard_map_preview(map, live_server, datalayer, login):
    page = login(map.owner)
    page.goto(f"{live_server.url}/en/me")
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_hidden()
    button = page.get_by_role("button", name="Open preview")
    expect(button).to_be_visible()
    button.click()
    expect(dialog).to_be_visible()
    # Let's check we have a marker on it, so we can guess the map loaded correctly
    expect(dialog.locator(".leaflet-marker-icon")).to_be_visible()


def test_no_delete_button_for_editors(map, live_server, datalayer, login, user):
    map.name = "Map I cannot delete"
    map.editors.add(user)
    map.save()
    page = login(user)
    page.goto(f"{live_server.url}/en/me")
    expect(page.get_by_text("Map I cannot delete")).to_be_visible()
    expect(page.get_by_title("Delete")).to_be_hidden()
