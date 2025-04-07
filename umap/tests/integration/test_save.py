import re


def test_reseting_map_would_remove_from_save_queue(
    live_server, openmap, page, datalayer
):
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Edit map name and caption").click()
    requests = []

    def register_request(request):
        if request.url.endswith(".png"):
            return
        requests.append((request.method, request.url))

    page.on("request", register_request)
    page.locator('input[name="name"]').click()
    page.locator('input[name="name"]').fill("new name")
    page.locator(".edit-undo").click()
    page.wait_for_timeout(500)
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Edit", exact=True).click()
    page.locator('input[name="name"]').click()
    page.locator('input[name="name"]').fill("new datalayer name")
    page.wait_for_timeout(300)  # Time of the Input debounce
    with page.expect_response(re.compile(".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save", exact=True).click()
    assert len(requests) == 1
    assert requests == [
        (
            "POST",
            f"{live_server.url}/en/map/{openmap.pk}/datalayer/update/{datalayer.pk}/",
        ),
    ]
