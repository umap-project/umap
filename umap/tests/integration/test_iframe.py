from playwright.sync_api import expect


def test_home_control_is_hidden(live_server, map, tilelayer, page):
    body = f"""
    <html>
        <head></head>
        <body>
            <iframe width="100%" height="300px" frameborder="0" allowfullscreen allow="geolocation"
            src="{map.get_absolute_url()}?scaleControl=false&miniMap=false&scrollWheelZoom=false&zoomControl=true&editMode=disabled&moreControl=true&searchControl=null&tilelayersControl=null&embedControl=null&datalayersControl=true&onLoadPanel=caption&captionBar=false&captionMenus=true"></iframe>
        </body>
    </html>
    """

    def handle(route):
        route.fulfill(body=body)

    url = f"{live_server.url}/test-iframe"
    # Intercept the route
    page.route(url, handle)

    page.goto(url)
    expect(
        page.locator("iframe").content_frame.get_by_role("link", name="Home logo")
    ).to_be_hidden()
