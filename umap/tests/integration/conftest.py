import os
import subprocess
import time
from pathlib import Path

import pytest
from playwright.sync_api import expect


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
        page.route("*/**/osmfr/**", lambda route: route.fulfill())


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


@pytest.fixture
def websocket_server():
    # Find the test-settings, and put them in the current environment
    settings_path = (Path(__file__).parent.parent / "settings.py").absolute().as_posix()
    os.environ["UMAP_SETTINGS"] = settings_path

    ds_proc = subprocess.Popen(
        [
            "umap",
            "run_websocket_server",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    time.sleep(2)
    # Ensure it started properly before yielding
    assert not ds_proc.poll(), ds_proc.stdout.read().decode("utf-8")
    yield ds_proc
    # Shut it down at the end of the pytest session
    ds_proc.terminate()
