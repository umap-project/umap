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
    assert Map.objects.all().count() == 0
