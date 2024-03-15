from playwright.sync_api import expect


def test_should_have_fieldset_for_layer_type_properties(page, live_server, tilelayer):
    page.goto(f"{live_server.url}/en/map/new/")

    # Open DataLayers list
    page.get_by_title("Manage layers").click()

    # Create a layer
    page.get_by_title("Add a layer").click()
    page.locator("input[name=name]").fill("Layer 1")

    select = page.locator(".panel.on .umap-field-type select")
    expect(select).to_be_visible()

    choropleth_header = page.get_by_text("Choropleth: settings")
    heat_header = page.get_by_text("Heatmap: settings")
    cluster_header = page.get_by_text("Clustered: settings")
    expect(choropleth_header).to_be_hidden()
    expect(heat_header).to_be_hidden()
    expect(cluster_header).to_be_hidden()

    # Switching to Choropleth should add a dedicated fieldset
    select.select_option("Choropleth")
    expect(choropleth_header).to_be_visible()
    expect(heat_header).to_be_hidden()
    expect(cluster_header).to_be_hidden()

    select.select_option("Heat")
    expect(heat_header).to_be_visible()
    expect(choropleth_header).to_be_hidden()
    expect(cluster_header).to_be_hidden()

    select.select_option("Cluster")
    expect(cluster_header).to_be_visible()
    expect(choropleth_header).to_be_hidden()
    expect(heat_header).to_be_hidden()

    select.select_option("Default")
    expect(choropleth_header).to_be_hidden()
    expect(heat_header).to_be_hidden()
    expect(cluster_header).to_be_hidden()
