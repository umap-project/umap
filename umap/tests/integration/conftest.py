import os
import re
from io import BytesIO
from pathlib import Path

import pytest
from daphne.testing import DaphneProcess
from django.contrib.staticfiles.handlers import ASGIStaticFilesHandler
from django.template.defaultfilters import slugify
from PIL import Image
from pixelmatch.contrib.PIL import pixelmatch
from playwright.sync_api import expect

from umap.asgi import application

from ..base import mock_tiles


def tiles_are_mocked():
    # PWDEBUG/FORCE_TILES load real tiles, so map content is non-deterministic.
    return not bool(os.environ.get("PWDEBUG", os.environ.get("FORCE_TILES", False)))


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {
        **browser_context_args,
        "locale": "en-GB",
        "timezone_id": "Europe/Paris",
        # Pin everything that shifts pixels across machines/CI so screenshots are
        # reproducible: fixed window, no Retina scaling, light theme, no motion.
        "viewport": {"width": 1280, "height": 720},
        "device_scale_factor": 1,
        "color_scheme": "light",
        "reduced_motion": "reduce",
        "forced_colors": "none",
    }


@pytest.fixture(autouse=True)
def set_timeout(context):
    timeout = int(os.environ.get("PLAYWRIGHT_TIMEOUT", 7500))
    context.set_default_timeout(timeout)
    context.set_default_navigation_timeout(timeout)
    expect.set_options(timeout=timeout)


@pytest.fixture
def new_page(context):
    def make_page(prefix="console", custom_context=None):
        _context = custom_context or context
        page = _context.new_page()
        page.on(
            "console",
            lambda msg: (
                print(f"{prefix}: {msg.text}") if msg.type != "warning" else None
            ),
        )
        page.on(
            "pageerror",
            lambda exc: print(f"{prefix} uncaught exception:\n{exc.stack}"),
        )
        if tiles_are_mocked():
            page.route(re.compile(r".*\btile\..*"), mock_tiles)
        return page

    yield make_page


@pytest.fixture
def page(new_page):
    return new_page()


@pytest.fixture
def wait_for_loaded():
    def _(page):
        page.locator(".umap-loaded").first.wait_for()

    return _


@pytest.fixture
def wait_for_edit_mode():
    def _(page):
        # Body is 0px height, so Playwright will never sees it as visible.
        page.locator(".umap-edit-enabled").first.wait_for(state="attached")

    return _


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


def asgi_application():
    return ASGIStaticFilesHandler(application)


@pytest.fixture(scope="function")
def asgi_live_server(request, live_server, settings, db):
    server = DaphneProcess("localhost", asgi_application)
    server.start()
    server.ready.wait()
    port = server.port.value
    server.url = f"http://localhost:{port}"

    yield server

    server.terminate()
    server.join()


@pytest.fixture
def assert_screenshot(request, wait_for_loaded):
    update = request.config.getoption("--update-screenshots")

    def assert_(locator_or_page, suffix="", clip=None, ui=True):
        # Hide this helper's frame so a failure points at the calling test line.
        __tracebackhide__ = True
        # expected screenshots are run without tiles, so in DEBUG mode trying to
        # compare screenshots will always fail.
        if not tiles_are_mocked():
            return
        page = (
            locator_or_page.page
            if hasattr(locator_or_page, "page")
            else locator_or_page
        )
        # Hide panels and controls for a cleaner map screenshot.
        if not ui:
            page.emulate_media(media="print")
        dirname = Path(__file__).parent.parent / "screenshots"
        suffix = f"-{suffix}" if suffix else ""
        basename = slugify(f"{request.module.__name__}.{request.node.name}{suffix}")
        expected_filename = dirname / f"{basename}.expected.png"
        wait_for_loaded(page)
        # Do not screenshot while anything is loading in the map (tiles…).
        expect(page.locator(".umap-loading")).to_have_count(0)
        # Freeze CSS animations/transitions (e.g. the edit bar sliding in) to their
        # final state, else the capture races the animation and flakes.
        kwargs = {}
        if clip:
            kwargs["clip"] = clip
        screenshot = locator_or_page.screenshot(animations="disabled", **kwargs)
        if not ui:
            page.emulate_media(media="screen")
        if update:
            expected_filename.write_bytes(screenshot)
            return
        if not expected_filename.exists():
            raise AssertionError(
                f"Missing screenshot baseline: {expected_filename}\n"
                "Run the tests with --update-screenshots to create it."
            )
        expected = Image.open(expected_filename)
        actual = Image.open(BytesIO(screenshot))
        img_diff = Image.new("RGBA", expected.size)
        mismatch = pixelmatch(
            expected, actual, img_diff, includeAA=False, threshold=0.3
        )
        if mismatch:
            actual_filename = dirname / f"{basename}.actual.png"
            diff_filename = dirname / f"{basename}.diff.png"
            actual_filename.write_bytes(screenshot)
            img_diff.save(diff_filename)
            raise AssertionError(
                f"Screenshot mismatch: {mismatch} pixels differ.\n"
                f"  expected: {expected_filename}\n"
                f"  actual:   {actual_filename}\n"
                f"  diff:     {diff_filename}"
            )

    return assert_
