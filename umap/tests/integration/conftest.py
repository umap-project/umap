import os
from pathlib import Path

import pytest
from playwright.sync_api import expect
from xprocess import ProcessStarter


@pytest.fixture(autouse=True)
def set_timeout(context):
    timeout = int(os.environ.get("PLAYWRIGHT_TIMEOUT", 7500))
    context.set_default_timeout(timeout)
    context.set_default_navigation_timeout(timeout)
    expect.set_options(timeout=timeout)


@pytest.fixture(autouse=True)
def mock_osm_tiles(page):
    if not bool(os.environ.get("PLAYWRIGHT_USE_TILES", False)):
        page.route("*/**/osmfr/**", lambda route: route.fulfill())


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
        return page

    return do_login


@pytest.fixture()
def websocket_server(xprocess):
    class Starter(ProcessStarter):
        settings_path = (
            (Path(__file__).parent.parent / "settings.py").absolute().as_posix()
        )
        os.environ["UMAP_SETTINGS"] = settings_path
        # env = {"UMAP_SETTINGS": settings_path}
        pattern = "Waiting for connections*"
        args = ["python", "-m", "umap.ws"]
        timeout = 1
        terminate_on_interrupt = True

    xprocess.ensure("websocket_server", Starter)
    yield
    xprocess.getinfo("websocket_server").terminate()
