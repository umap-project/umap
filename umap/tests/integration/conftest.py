import os
import re

import pytest
from daphne.testing import DaphneProcess
from django.contrib.staticfiles.handlers import ASGIStaticFilesHandler
from playwright.sync_api import expect

from umap.asgi import application

from ..base import mock_tiles


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {**browser_context_args, "locale": "en-GB", "timezone_id": "Europe/Paris"}


@pytest.fixture(autouse=True)
def set_timeout(context):
    timeout = int(os.environ.get("PLAYWRIGHT_TIMEOUT", 7500))
    context.set_default_timeout(timeout)
    context.set_default_navigation_timeout(timeout)
    expect.set_options(timeout=timeout)


@pytest.fixture(autouse=True)
def mock_osm_tiles(page):
    if not bool(os.environ.get("PWDEBUG", False)):
        page.route(re.compile(r".*tile\..*"), mock_tiles)


@pytest.fixture
def new_page(context):
    def make_page(prefix="console"):
        page = context.new_page()
        page.on(
            "console",
            lambda msg: print(f"{prefix}: {msg.text}")
            if msg.type != "warning"
            else None,
        )
        page.on("pageerror", lambda exc: print(f"{prefix} uncaught exception: {exc}"))
        return page

    yield make_page


@pytest.fixture
def page(new_page):
    return new_page()


@pytest.fixture
def login(new_page, settings, live_server):
    def do_login(user, **kwargs):
        # TODO use storage state to do login only once per session
        # https://playwright.dev/python/docs/auth
        settings.ENABLE_ACCOUNT_LOGIN = True
        page = new_page(**kwargs)
        page.goto(f"{live_server.url}/en/")
        page.locator(".login").click()
        page.get_by_placeholder("Username").fill(user.username)
        page.get_by_placeholder("Password").fill("123123")
        page.locator('#login_form input[type="submit"]').click()
        return page

    return do_login


@pytest.fixture(scope="function")
def asgi_live_server(request, live_server):
    server = DaphneProcess("localhost", lambda: ASGIStaticFilesHandler(application))
    server.start()
    server.ready.wait()
    port = server.port.value
    server.url = f"http://localhost:{port}"

    yield server

    server.terminate()
    server.join()
