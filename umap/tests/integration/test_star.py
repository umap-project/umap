import re

import pytest
from playwright.sync_api import expect

from umap.models import Star

pytestmark = pytest.mark.django_db


def test_star_button_is_active_if_logged_in(map, live_server, page, login, user):
    login(user)
    assert not Star.objects.count()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    page.get_by_title("About").click()
    button = page.locator(".icon-star")
    expect(button).to_be_visible()
    with page.expect_response(re.compile(".*/star/")):
        button.click()
    expect(button).to_be_hidden()
    # Button has changed
    expect(page.locator(".icon-starred")).to_be_visible()
    assert Star.objects.count() == 1


def test_star_button_inctive_if_not_logged_in(map, live_server, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    page.get_by_title("About").click()
    button = page.locator(".icon-star")
    button.click()
    expect(page.get_by_text("You must be logged in")).to_be_visible()
