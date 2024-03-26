from playwright.sync_api import expect


def test_can_edit_name(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    page.get_by_title("Edit map properties").click()
    name_input = page.locator('.map-metadata input[name="name"]')
    expect(name_input).to_be_visible()
    name_input.click()
    name_input.press("Control+a")
    name_input.fill("New map name")
    expect(page.locator(".umap-main-edit-toolbox .map-name")).to_have_text(
        "New map name"
    )
