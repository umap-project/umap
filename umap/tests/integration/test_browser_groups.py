import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "collapse,override,expanded",
    [
        (False, "inherit", True),
        (True, "inherit", False),
        (True, "expanded", True),
        (False, "collapsed", False),
    ],
)
def test_group_initial_state_and_visibility(
    live_server, page, map, collapse, override, expanded
):
    map.settings["properties"].update(
        onLoadPanel="databrowser", collapseGroupsOnLoad=collapse
    )
    map.save()
    group = DataLayerFactory(
        map=map,
        group=True,
        data={},
        settings={"browserExpandedOnLoad": override},
    )
    child = DataLayerFactory(map=map, parent=group)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    details = page.locator(f'.umap-browser details[data-id="{group.pk}"]')
    expect(details).to_have_js_property("open", expanded)
    # Disclosure must not touch visibility, including after a redraw or reload.
    summary = details.locator(":scope > summary")
    expect(summary).not_to_contain_class("off")
    expect(
        page.locator(f'.umap-browser summary[data-id="{child.pk}"]')
    ).not_to_contain_class("off")
    summary.focus()
    page.keyboard.press("Enter")
    expect(details).to_have_js_property("open", not expanded)
    expect(summary).not_to_contain_class("off")
    page.reload()
    expect(details).to_have_js_property("open", expanded)


def test_group_settings_can_be_saved(live_server, page, openmap):
    group = DataLayerFactory(map=openmap, group=True, data={})
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_title("Manage layers", exact=True).click()
    page.locator(f'details[data-id="{group.pk}"]').get_by_title(
        "Edit", exact=True
    ).click()
    page.get_by_text("Collapsed", exact=True).click()
    with page.expect_response(
        lambda response: (
            "/datalayer/update/" in response.url and response.request.method == "POST"
        )
    ):
        page.get_by_role("button", name="Save", exact=True).click()
    group.refresh_from_db()
    assert group.settings["browserExpandedOnLoad"] == "collapsed"


def test_map_group_setting_can_be_saved(live_server, page, openmap):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_title("Map advanced properties", exact=True).click()
    page.get_by_text("User interface options", exact=True).click()
    page.get_by_text("Collapse layer groups on load", exact=True).click()
    with page.expect_response(
        lambda response: (
            "/update/settings/" in response.url and response.request.method == "POST"
        )
    ):
        page.get_by_role("button", name="Save", exact=True).click()
    openmap.refresh_from_db()
    assert openmap.settings["properties"]["collapseGroupsOnLoad"] is True


def test_disclosure_arrows_and_keyboard(live_server, page, openmap):
    group = DataLayerFactory(map=openmap, group=True, data={})
    child = DataLayerFactory(map=openmap, parent=group)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?onLoadPanel=databrowser")
    for layer in [group, child]:
        details = page.locator(f'.umap-browser details[data-id="{layer.pk}"]')
        heading = details.locator(":scope > summary > span:first-child")
        assert (
            heading.evaluate("el => getComputedStyle(el, '::before').content") == '""'
        )
        summary = details.locator(":scope > summary")
        summary.focus()
        page.keyboard.press("Enter")
        expect(details).to_have_js_property("open", False)
        page.keyboard.press("Enter")
        expect(details).to_have_js_property("open", True)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_title("Manage layers", exact=True).click()
    details = page.locator(f'details.expandable-layer-group[data-id="{group.pk}"]')
    summary = details.locator(":scope > summary")
    summary.focus()
    page.keyboard.press("Enter")
    expect(details).to_have_js_property("open", False)
