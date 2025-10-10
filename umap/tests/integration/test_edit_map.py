import re

from playwright.sync_api import expect

from umap.models import DataLayer, Map

from ..base import DataLayerFactory


def test_can_edit_name(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    page.get_by_title("Edit map name and caption").click()
    name_input = page.locator('.map-metadata input[name="name"]')
    expect(name_input).to_be_visible()
    name_input.click()
    name_input.press("Control+a")
    name_input.fill("New map name")
    expect(page.locator(".umap-main-edit-toolbox .map-name").nth(0)).to_have_text(
        "New map name"
    )


def test_can_display_help(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    page.get_by_title("Edit map name and caption").click()
    help_button = page.locator(".panel .umap-field-description .umap-help-button")
    expect(help_button).to_be_visible()
    help_button.click()
    expect(page.locator("dialog").first).to_contain_text("Text formatting")


def test_can_edit_name_on_click_on_toolbar(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")
    page.locator(".umap-main-edit-toolbox .map-name").click()
    name_input = page.locator('.map-metadata input[name="name"]')
    expect(name_input).to_be_visible()


def test_map_name_impacts_ui(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    gear_icon = page.get_by_title("Edit map name and caption")
    expect(gear_icon).to_be_visible()
    gear_icon.click()

    name_input = page.locator("form").locator('input[name="name"]').first
    expect(name_input).to_be_visible()

    name_input.fill("something else")

    expect(page.get_by_role("button", name="something else").first).to_be_visible()


def test_zoomcontrol_impacts_ui(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    gear_icon = page.get_by_title("Map advanced properties")
    expect(gear_icon).to_be_visible()
    gear_icon.click()

    # Should be visible by default
    zoom_in = page.get_by_label("Zoom in")
    zoom_out = page.get_by_label("Zoom out")

    expect(zoom_in).to_be_visible()
    expect(zoom_out).to_be_visible()

    # Hide them
    page.get_by_text("User interface options").click()
    page.locator(".panel .umap-field-zoomControl").get_by_text("never").click()

    expect(zoom_in).to_be_hidden()
    expect(zoom_out).to_be_hidden()


def test_map_color_impacts_data(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    gear_icon = page.get_by_title("Map advanced properties")
    expect(gear_icon).to_be_visible()
    gear_icon.click()

    # Click on the Draw a marker button on a new map.
    create_marker_p1 = page.get_by_title("Draw a marker")
    expect(create_marker_p1).to_be_visible()
    create_marker_p1.click()

    # Add a new marker
    marker_pane_p1 = page.locator(".leaflet-marker-pane > div")
    map_el = page.locator("#map")
    map_el.click(position={"x": 200, "y": 200})
    expect(marker_pane_p1).to_have_count(1)

    # Change the default color
    page.get_by_text("Shape properties").click()
    page.locator("#umap-feature-shape-properties").get_by_text("define").first.click()
    page.get_by_title("Lime", exact=True).click()

    # Assert the new color was used
    marker_style = page.locator(".leaflet-marker-icon .icon-container").get_attribute(
        "style"
    )
    assert "lime" in marker_style


def test_limitbounds_impacts_ui(live_server, page, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    gear_icon = page.get_by_title("Map advanced properties")
    expect(gear_icon).to_be_visible()
    gear_icon.click()

    page.get_by_text("Limit bounds").click()
    default_zoom_url = f"{live_server.url}/en/map/new/#5/51.110/7.053"
    page.goto(default_zoom_url)
    page.get_by_role("button", name="Use current bounds").click()

    zoom_in = page.get_by_label("Zoom in")
    zoom_out = page.get_by_label("Zoom out")

    # It should be possible to zoom in
    zoom_in.click()
    page.wait_for_timeout(500)
    assert page.url != default_zoom_url

    # But not to zoom out of the window
    zoom_out.click()  # back to normal
    page.wait_for_timeout(500)
    assert "leaflet-disabled" in zoom_out.get_attribute("class")


def test_sortkey_impacts_datalayerindex(map, live_server, page):
    # Create points with a "key" property.
    # But we want them to sort by key (First, Second, Third)
    DataLayerFactory(
        map=map,
        data={
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [13.6, 48.5],
                    },
                    "properties": {"name": "Z First", "key": "1st Point"},
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [13.7, 48.4],
                    },
                    "properties": {"name": "Y Second", "key": "2d Point"},
                },
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [13.5, 48.6],
                    },
                    "properties": {"name": "X Third", "key": "3rd Point"},
                },
            ],
        },
    )
    map.edit_status = Map.ANONYMOUS
    datalayer = map.datalayer_set.first()
    datalayer.edit_status = DataLayer.ANONYMOUS
    datalayer.save()
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}")

    # By default, features are sorted by name  (Third, Second, First)
    page.get_by_role("button", name="Open browser").click()
    page.locator(".umap-browser .datalayer-name").click()

    first_listed_feature = page.locator(".umap-browser .datalayer ul > li").nth(0)
    second_listed_feature = page.locator(".umap-browser .datalayer ul > li").nth(1)
    third_listed_feature = page.locator(".umap-browser .datalayer ul > li").nth(2)
    assert "X Third" == first_listed_feature.text_content().strip()
    assert "Y Second" == second_listed_feature.text_content().strip()
    assert "Z First" == third_listed_feature.text_content().strip()

    # Change the default sortkey to be "key"
    page.get_by_role("button", name="Edit").click()
    page.get_by_role("button", name="Map advanced properties").click()
    page.get_by_text("Default properties").click()

    # Click "define"
    page.locator(".panel .umap-field-sortKey .define").click()
    page.locator('input[name="sortKey"]').click()
    page.locator('input[name="sortKey"]').fill("key")

    # Click the checkmark to apply the changes
    page.locator(".panel .umap-field-sortKey .blur-container button").click()

    # Features should be sorted by key  (First, Second, Third)
    first_listed_feature = page.locator(".umap-browser .datalayer ul > li").nth(0)
    second_listed_feature = page.locator(".umap-browser .datalayer ul > li").nth(1)
    third_listed_feature = page.locator(".umap-browser .datalayer ul > li").nth(2)
    assert "Z First" == first_listed_feature.text_content().strip()
    assert "Y Second" == second_listed_feature.text_content().strip()
    assert "X Third" == third_listed_feature.text_content().strip()


def test_hover_tooltip_setting_should_be_persistent(live_server, map, page):
    map.settings["properties"]["showLabel"] = None
    map.edit_status = Map.ANONYMOUS
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    page.get_by_role("button", name="Map advanced properties").click()
    page.get_by_text("Default interaction options").click()
    expect(page.get_by_text("on hover")).to_be_visible()
    expect(page.locator(".umap-field-showLabel")).to_match_aria_snapshot("""
        - text: Display label
        - button "clear"
        - text: always never on hover
    """)
    expect(page.locator(".umap-field-showLabel input[value=null]")).to_be_checked()


def test_can_edit_map_tags(live_server, map, page):
    map.settings["properties"]["tags"] = ["arts"]
    map.edit_status = Map.ANONYMOUS
    map.save()
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit")
    page.get_by_role("button", name="Edit map name and caption").click()
    page.get_by_text("Tags").click()
    expect(page.get_by_label("Art and Culture")).to_be_checked()
    page.get_by_label("Cycling").check()
    with page.expect_response(re.compile("./update/settings/.*")):
        page.get_by_role("button", name="Save").click()
    saved = Map.objects.get(pk=map.pk)
    assert saved.tags == ["arts", "cycling"]
