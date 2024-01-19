import re
import shutil
import tempfile

import pytest
from django.core.management import call_command
from django.utils.translation import override
from playwright.sync_api import expect


@pytest.fixture
def staticfiles(settings):
    static_root = tempfile.mkdtemp(prefix="test_static")
    settings.STATIC_ROOT = static_root
    try:
        call_command("collectstatic", "--noinput")
        yield
    finally:
        shutil.rmtree(static_root)


def test_javascript_have_been_loaded(
    map, live_server, datalayer, page, settings, staticfiles
):
    settings.STORAGES["staticfiles"][
        "BACKEND"
    ] = "umap.storage.UmapManifestStaticFilesStorage"
    datalayer.settings["displayOnLoad"] = False
    datalayer.save()
    map.settings["properties"]["defaultView"] = "latest"
    map.save()
    with override("fr"):
        url = f"{live_server.url}{map.get_absolute_url()}"
        assert "/fr/" in url
        page.goto(url)
    # Hash is defined, so map is initialized
    expect(page).to_have_url(re.compile(r".*#7/48\..+/13\..+"))
    expect(page).to_have_url(re.compile(r".*/fr/"))
    # Should be in French, so hashed locale file has been loaded correctly
    button = page.get_by_text("Voir les calques")
    expect(button).to_be_visible()
    layers = page.locator(".umap-browse-datalayers li")
    expect(layers).to_have_count(1)
