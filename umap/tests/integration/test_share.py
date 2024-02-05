import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.django_db


def test_iframe_code(map, live_server, datalayer, page):
    page.goto(f"{live_server.url}{map.get_absolute_url()}?share")
    textarea = page.locator(".umap-share-iframe")
    expect(textarea).to_be_visible()
    expect(textarea).to_have_text(re.compile('src="'))
    expect(textarea).to_have_text(re.compile('href="'))
    # We should ave both, once for iframe link, once for full screen
    expect(textarea).to_have_text(re.compile("scrollWheelZoom=true"))
    expect(textarea).to_have_text(re.compile("scrollWheelZoom=false"))
    expect(textarea).not_to_have_text(re.compile(f"datalayers={datalayer.pk}"))
    # Open options
    page.get_by_text("Embed and link options").click()
    page.get_by_title("Keep current visible layers").click()
    expect(textarea).to_have_text(re.compile(f"datalayers={datalayer.pk}"))
