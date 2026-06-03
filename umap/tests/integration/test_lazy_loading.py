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
            loaded.add(path)

    page.on("request", register)
    return loaded


def test_lazy_modules_not_loaded_on_basic_view(
    page, live_server, openmap, datalayer, tilelayer, loaded_js_modules
):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}")
    page.wait_for_load_state("networkidle")

    # These modules must stay lazy: not pulled on a plain view load.
    lazy_modules = [
        "/static/umap/js/modules/share.js",
        "/static/umap/js/modules/browser.js",
        "/static/umap/js/modules/importer.js",
        "/static/umap/js/modules/importers/openrouteservice.js",
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

    assert "/static/umap/js/modules/share.js" in loaded_js_modules
