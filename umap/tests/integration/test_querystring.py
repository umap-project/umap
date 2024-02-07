import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.django_db


def test_scale_control(map, live_server, datalayer, page):
    control = page.locator(".leaflet-control-scale")
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(control).to_be_visible()
    page.goto(f"{live_server.url}{map.get_absolute_url()}?scaleControl=false")
    expect(control).to_be_hidden()


def test_datalayers_control(map, live_server, datalayer, page):
    control = page.locator(".umap-browse-toggle")
    box = page.locator(".umap-browse-datalayers")
    more = page.get_by_title("More controls")
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(control).to_be_visible()
    expect(box).to_be_hidden()
    page.goto(f"{live_server.url}{map.get_absolute_url()}?datalayersControl=true")
    expect(control).to_be_visible()
    expect(box).to_be_hidden()
    page.goto(f"{live_server.url}{map.get_absolute_url()}?datalayersControl=null")
    expect(control).to_be_hidden()
    expect(more).to_be_visible()
    more.click()
    expect(control).to_be_visible()
    expect(box).to_be_hidden()
    page.goto(f"{live_server.url}{map.get_absolute_url()}?datalayersControl=false")
    expect(control).to_be_hidden()
    expect(more).to_be_visible()
    more.click()
    expect(control).to_be_hidden()
    expect(box).to_be_hidden()
    page.goto(f"{live_server.url}{map.get_absolute_url()}?datalayersControl=expanded")
    expect(control).to_be_hidden()
    expect(box).to_be_visible()


def test_can_deactivate_wheel_from_query_string(map, live_server, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(page).to_have_url(re.compile(r".*#7/.+"))
    page.mouse.wheel(0, 1)
    expect(page).to_have_url(re.compile(r".*#6/.+"))
    page.goto(f"{live_server.url}{map.get_absolute_url()}?scrollWheelZoom=false")
    expect(page).to_have_url(re.compile(r".*#7/.+"))
    page.mouse.wheel(0, 1)
    expect(page).to_have_url(re.compile(r".*#7/.+"))
