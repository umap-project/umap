import pytest
from playwright.sync_api import expect

from ..base import DataLayerFactory, MapFactory

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("group", [False, True])
def test_groups_work_without_browser_storage(live_server, page, map, group):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.save()
    layer = DataLayerFactory(map=map, group=group, data={} if group else None)
    if group:
        DataLayerFactory(map=map, parent=layer)
    page.add_init_script("""
        Storage.prototype.getItem = () => { throw new Error('Storage disabled') }
        Storage.prototype.setItem = () => { throw new Error('Storage disabled') }
    """)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    details = page.locator(f'.umap-browser details[data-id="{layer.pk}"]')
    expect(details).to_have_js_property("open", True)
    details.locator(":scope > summary").click()
    expect(details).to_have_js_property("open", False)
    page.evaluate("window.U.MAP.browser.update()")
    expect(details).to_have_js_property("open", False)


def test_point_lists_remain_collapsed_after_reload(live_server, page, map):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.save()
    group = DataLayerFactory(map=map, group=True, data={})
    child = DataLayerFactory(map=map, parent=group)
    other = DataLayerFactory(map=map, parent=group)
    standalone = DataLayerFactory(map=map)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")

    def details(layer):
        return page.locator(f'.umap-browser details[data-id="{layer.pk}"]')

    for layer in [child, standalone]:
        expect(details(layer)).to_have_js_property("open", True)
        details(layer).locator(":scope > summary").click()
        expect(details(layer)).to_have_js_property("open", False)
    # Closing the group must not overwrite the children's individual states.
    details(group).locator(":scope > summary").click()
    page.reload()
    expect(details(group)).to_have_js_property("open", False)
    details(group).locator(":scope > summary").click()
    for layer in [child, standalone]:
        expect(details(layer)).to_have_js_property("open", False)
        expect(details(layer).locator(":scope > summary")).not_to_contain_class("off")
    expect(details(other)).to_have_js_property("open", True)
    details(child).locator(":scope > summary").click()
    page.reload()
    expect(details(group)).to_have_js_property("open", True)
    expect(details(child)).to_have_js_property("open", True)
    expect(details(standalone)).to_have_js_property("open", False)


@pytest.mark.parametrize("stored", ["invalid JSON", '[["layer", "false"], null, {}]'])
def test_invalid_stored_state_uses_map_defaults(live_server, page, map, stored):
    map.settings["properties"].update(onLoadPanel="databrowser")
    map.save()
    group = DataLayerFactory(map=map, group=True, data={})
    DataLayerFactory(map=map, parent=group)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    details = page.locator(f'.umap-browser details[data-id="{group.pk}"]')
    expect(details).to_have_js_property("open", True)
    page.evaluate(
        "(value) => localStorage.setItem(window.U.MAP.browser.storageKey, value)",
        stored,
    )
    page.reload()
    details = page.locator(f'.umap-browser details[data-id="{group.pk}"]')
    expect(details).to_have_js_property("open", True)
    details.locator(":scope > summary").click()
    page.reload()
    expect(details).to_have_js_property("open", False)


def test_disclosure_preference_is_scoped_to_map(live_server, page, map):
    map.settings["properties"]["onLoadPanel"] = "databrowser"
    map.save()
    other_map = MapFactory(settings=map.settings)
    first = DataLayerFactory(map=map)
    second = DataLayerFactory(map=other_map)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    details = page.locator(f'.umap-browser details[data-id="{first.pk}"]')
    details.locator(":scope > summary").click()
    page.goto(f"{live_server.url}{other_map.get_absolute_url()}")
    expect(
        page.locator(f'.umap-browser details[data-id="{second.pk}"]')
    ).to_have_js_property("open", True)
    page.goto(f"{live_server.url}{map.get_absolute_url()}")
    expect(details).to_have_js_property("open", False)
