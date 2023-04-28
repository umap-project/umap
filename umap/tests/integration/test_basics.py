import pytest
from playwright.sync_api import expect


def test_page_title(page, live_server):
    page.goto(live_server.url)
    expect(page).to_have_title("uMap")


@pytest.mark.parametrize(
    "lang,link_name,link_url",
    [("fr", "Créer une carte", "/fr/map/new/"), ("en", "Create a map", "/en/map/new/")],
)
def test_create_map_link(page, live_server, lang, link_name, link_url):
    page.goto(f"{live_server.url}/{lang}/")
    create_map_button = page.locator("header nav a.button")
    expect(create_map_button).to_have_text(link_name)
    expect(create_map_button).to_have_attribute("href", link_url)
