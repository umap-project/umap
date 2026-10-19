from pathlib import Path

import pytest


@pytest.fixture
def loaded_js_modules(page, live_server):
    loaded = set()

    def register(request):
        url = request.url
        if not url.startswith(live_server.url):
            return
        path = url[len(live_server.url) :].split("?")[0]
        if path.startswith("/static/umap/") and path.endswith(".js"):
            loaded.add(Path(path).stem.split("-", 1)[0])

    page.on("request", register)
    return loaded


def test_lazy_modules_not_loaded_on_basic_view(
    page, live_server, openmap, datalayer, tilelayer, loaded_js_modules
):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}")
    page.wait_for_load_state("networkidle")
    assert loaded_js_modules == {"base", "i18n", "chunk", "en", "alert", "app"}

    # These modules must stay lazy: not pulled on a plain view load.
    lazy_modules = [
        "share",
        "browser",
        "caption",
        "orderable",
        "template",
        "templates",
        "importer",
        "openrouteservice",
    ]
    for module in lazy_modules:
        assert module not in loaded_js_modules, (
            f"{module} should not be loaded on a basic view"
        )


def test_share_module_loads_on_share_query_param(
    page, live_server, openmap, datalayer, tilelayer, loaded_js_modules
):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?share")
    page.wait_for_load_state("networkidle")

    assert "share" in loaded_js_modules


@pytest.mark.parametrize("loaded_panel", ["databrowser", "datalayers"])
def test_browser_module_loads_on_onloadpanel_query_param(
    page, live_server, openmap, datalayer, tilelayer, loaded_js_modules, loaded_panel
):
    page.goto(
        f"{live_server.url}{openmap.get_absolute_url()}?onLoadPanel={loaded_panel}"
    )
    page.wait_for_load_state("networkidle")

    assert "browser" in loaded_js_modules
