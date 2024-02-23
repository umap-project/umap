import re

import pytest
from playwright.sync_api import expect

from umap.models import Star

pytestmark = pytest.mark.django_db


def test_star_control_is_visible_if_logged_in(map, live_server, page, login, user):
    login(user)
    assert not Star.objects.count()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    page.get_by_title("More controls").click()
    control = page.locator(".leaflet-control-star")
    expect(control).to_be_visible()
    with page.expect_response(re.compile(".*/star/")):
        control.click()
    assert Star.objects.count() == 1


def test_no_star_control_if_not_logged_in(map, live_server, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    page.get_by_title("More controls").click()
    control = page.locator(".leaflet-control-star")
    expect(control).to_be_hidden()
