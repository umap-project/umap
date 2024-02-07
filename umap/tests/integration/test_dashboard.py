from time import sleep

import pytest
from playwright.sync_api import expect

from umap.models import Map

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


def test_owner_can_delete_map_after_confirmation(map, live_server, login):
    page = login(map.owner)
    page.goto(f"{live_server.url}/en/me")
    delete_button = page.get_by_title("Delete")
    expect(delete_button).to_be_visible()
    page.on("dialog", lambda dialog: dialog.accept())
    with page.expect_response(f"/map/{map.pk}/update/delete/"):
        delete_button.click()
    assert Map.objects.all().count() == 0
