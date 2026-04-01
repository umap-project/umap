# import platform
import re
import time

from playwright.sync_api import expect

from umap.models import DataLayer

from ..base import DataLayerFactory


def dragTo(page, source, target, mode):
    targetBox = target.bounding_box()
    # Insist on hover, otherwise the event his sometimes not fired by Playwright agent.
    source.locator(".with-toolbox").first.hover(position={"x": 30, "y": 10})
    source.locator(".with-toolbox").first.hover(position={"x": 50, "y": 12})
    source.locator(".with-toolbox").first.hover(position={"x": 100, "y": 15})
    drag = source.locator(".icon-drag").first
    dragBox = drag.bounding_box()
    drag.hover(position={"x": 5, "y": 5})
    page.mouse.down()
    page.mouse.move(
        x=dragBox["x"] + dragBox["width"] / 2,
        y=dragBox["y"] + dragBox["height"] / 2,
    )
    match mode:
        case "above":
            y = 10
        case "below":
            y = targetBox["height"] - 1
        case "middle":
            y = targetBox["height"] / 2
    x = targetBox["width"] / 2
    page.mouse.move(x=targetBox["x"] + x, y=targetBox["y"] + y)
    # Target the middle of the target element, so to add the moved element as child
    target.hover(position={"x": x, "y": y})
    page.mouse.up()


def test_can_add_parent_from_edit_panel(page, live_server, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Add a group").click()
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Add a layer").click()
    page.get_by_label("Group", exact=True).select_option("Group 1")
    page.get_by_role("button", name="Manage layers").click()
    # Layer 1 should be under Layer 2
    parent = page.locator(".panel.right details").first
    expect(parent.locator("summary").first).to_have_text("Group 1")
    child = parent.locator("details").first
    expect(child.locator("summary").first).to_have_text("Layer 2")
    with page.expect_response(re.compile(".*/datalayer/create/.*")):
        page.get_by_role("button", name="Save draft").click()
    parent = DataLayer.objects.get(parent=None)
    time.sleep(0.5)
    child = DataLayer.objects.get(parent=parent)
    assert child.parent == parent


def test_can_remove_parent_from_edit_panel(page, live_server, tilelayer, openmap):
    parent = DataLayerFactory(name="Parent Layer", map=openmap, data=None, group=True)
    child = DataLayerFactory(name="Child Layer", map=openmap, parent=parent)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Edit", exact=True).nth(1).click()
    page.get_by_label("Group", exact=True).select_option("null")
    page.get_by_role("button", name="Manage layers").click()
    parentEl = page.locator(".panel.right details").last
    expect(parentEl.locator("summary").first).to_have_text("Parent Layer")
    # No child
    expect(parentEl.locator("details")).to_be_hidden()
    childEl = page.locator(".panel.right details").first
    expect(childEl.locator("summary").first).to_have_text("Child Layer")
    with page.expect_response(re.compile(".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save").click()
    child.refresh_from_db()
    parent.refresh_from_db()
    assert not child.parent
    assert not parent.parent
    assert DataLayer.objects.count() == 2


def test_can_change_parent_from_edit_panel(page, live_server, tilelayer, openmap):
    parent = DataLayerFactory(name="Parent Layer", map=openmap, data=None, group=True)
    other = DataLayerFactory(name="Other Layer", map=openmap, data=None, group=True)
    child = DataLayerFactory(name="Child Layer", map=openmap, parent=parent)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Manage layers").click()
    page.locator(f"summary[data-id='{child.pk}']").get_by_role(
        "button", name="Edit", exact=True
    ).click()
    page.get_by_label("Group", exact=True).select_option("Other Layer")
    page.get_by_role("button", name="Manage layers").click()
    parentEl = page.locator(f".panel.right details[data-id='{parent.pk}']")
    expect(parentEl.locator("summary").first).to_have_text("Parent Layer")
    # No child
    expect(parentEl.locator("details")).to_be_hidden()
    otherEl = page.locator(f".panel.right details[data-id='{other.pk}']")
    expect(otherEl.locator("summary").first).to_have_text("Other Layer")
    childEl = otherEl.locator(f"details[data-id='{child.pk}']")
    expect(childEl.locator("summary").first).to_have_text("Child Layer")
    with page.expect_response(re.compile(".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save").click()
    child.refresh_from_db()
    other.refresh_from_db()
    parent.refresh_from_db()
    assert child.parent == other
    assert not parent.parent
    assert not other.parent
    assert DataLayer.objects.count() == 3


def test_can_drag_new_child(page, live_server, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Add a layer").click()
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Add a layer").click()
    page.get_by_role("button", name="Manage layers").click()
    target = page.locator(".panel.right li.orderable").first
    source = page.locator(".panel.right li.orderable").last
    dragTo(page, source, target, "middle")
    parent = page.locator(".panel.right details").first
    expect(parent.locator("summary").first).to_have_text("Layer 2")
    child = parent.locator("details").first
    expect(child.locator("summary").first).to_have_text("Layer 1")
    with page.expect_response(re.compile(".*/datalayer/create/.*")):
        page.get_by_role("button", name="Save").click()
    time.sleep(0.5)
    parent = DataLayer.objects.get(parent=None)
    child = DataLayer.objects.get(parent=parent)
    assert child.parent == parent


def test_can_drag_layer_above_other(page, live_server, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Add a group").click()
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Add a layer").click()
    page.get_by_role("button", name="Manage layers").click()
    target = page.locator(".panel.right li.orderable").first
    source = page.locator(".panel.right li.orderable").last
    dragTo(page, source, target, "above")
    parent = page.locator(".panel.right details").first
    expect(parent.locator("summary").first).to_have_text("Group 1")
    expect(parent.locator("details")).to_be_hidden()
    child = page.locator(".panel.right details").last
    expect(child.locator("summary").first).to_have_text("Layer 2")
    with page.expect_response(re.compile(".*/datalayer/create/.*")):
        page.get_by_role("button", name="Save").click()
    time.sleep(0.5)
    assert DataLayer.objects.count() == 2
    assert DataLayer.objects.filter(parent=None).count() == 2


def test_can_drag_layer_below_other(page, live_server, tilelayer, settings):
    settings.UMAP_ALLOW_ANONYMOUS = True
    page.goto(f"{live_server.url}/en/map/new/")
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Add a group").click()
    page.get_by_role("button", name="Manage layers").click()
    page.get_by_role("button", name="Add a layer").click()
    page.get_by_role("button", name="Manage layers").click()
    target = page.locator(".panel.right li.orderable").last
    source = page.locator(".panel.right li.orderable").first
    dragTo(page, source, target, "below")
    parent = page.locator(".panel.right details").first
    expect(parent.locator("summary").first).to_have_text("Group 1")
    expect(parent.locator("details")).to_be_hidden()
    child = page.locator(".panel.right details").last
    expect(child.locator("summary").first).to_have_text("Layer 2")
    with page.expect_response(re.compile(".*/datalayer/create/.*")):
        page.get_by_role("button", name="Save").click()
    time.sleep(0.5)
    assert DataLayer.objects.count() == 2
    assert DataLayer.objects.filter(parent=None).count() == 2


def test_can_drag_parent_with_children(page, live_server, tilelayer, openmap):
    dl1 = DataLayerFactory(name="DL 1", data=None, map=openmap, rank=4)
    dl2 = DataLayerFactory(name="DL 2", data=None, map=openmap, rank=3, group=True)
    dl3 = DataLayerFactory(name="DL 3", data=None, map=openmap, rank=2, group=True)
    dl4 = DataLayerFactory(name="DL 4", data=None, map=openmap, rank=1)
    dl5 = DataLayerFactory(name="DL 5", data=None, map=openmap, rank=0)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Open browser").click()
    browser = page.locator(".panel.left .umap-browser")
    datalayers = browser.locator("details.datalayer")
    expect(datalayers).to_have_count(5)

    page.get_by_role("button", name="Manage layers").click()
    dl1El = page.locator(f".panel.right li.orderable[data-id='{dl1.pk}']")
    dl2El = page.locator(f".panel.right li.orderable[data-id='{dl2.pk}']")
    dl3El = page.locator(f".panel.right li.orderable[data-id='{dl3.pk}']")
    dl4El = page.locator(f".panel.right li.orderable[data-id='{dl4.pk}']")
    dl5El = page.locator(f".panel.right li.orderable[data-id='{dl5.pk}']")

    dragTo(page, dl3El, dl2El, "middle")
    expect(datalayers).to_have_count(5)
    expect(dl2El).to_contain_text("DL 3")

    dragTo(page, dl4El, dl3El, "middle")
    expect(datalayers).to_have_count(5)
    expect(dl3El).to_contain_text("DL 4")

    dragTo(page, dl5El, dl4El, "below")
    expect(datalayers).to_have_count(5)
    expect(dl3El).to_contain_text("DL 5")

    dragTo(page, dl2El, dl1El, "above")
    expect(datalayers).to_have_count(5)
    expect(
        page.locator(".panel.right details").first.locator("summary").first
    ).to_have_text("DL 2")
    expect(dl2El.locator("details").nth(1).locator("summary").first).to_have_text(
        "DL 3"
    )
    expect(dl3El.locator("details").nth(1).locator("summary").first).to_have_text(
        "DL 4"
    )
    expect(dl3El.locator("details").last.locator("summary").last).to_have_text("DL 5")
    # DL 4 and 1 should have no child
    expect(dl4El.locator("details details")).to_be_hidden()
    expect(dl1El.locator("details details")).to_be_hidden()
    with page.expect_response(re.compile(".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save").click()
    time.sleep(2)
    assert DataLayer.objects.count() == 5
    # DL 1 and DL 2
    assert DataLayer.objects.filter(parent=None).count() == 2
    dl1.refresh_from_db()
    dl2.refresh_from_db()
    dl3.refresh_from_db()
    dl4.refresh_from_db()
    dl5.refresh_from_db()
    assert dl1.parent is None
    assert dl2.parent is None
    assert dl3.parent == dl2
    assert dl4.parent == dl3
    assert dl5.parent == dl3
    assert dl1.rank == 0
    assert dl2.rank == 1
    assert dl3.rank == 0
    assert dl4.rank == 1
    assert dl5.rank == 0


def test_can_drag_in_and_out(page, live_server, tilelayer, openmap):
    dl1 = DataLayerFactory(name="DL 1", data=None, map=openmap, rank=3)
    dl2 = DataLayerFactory(name="DL 2", data=None, map=openmap, rank=2)
    dl3 = DataLayerFactory(name="DL 3", data=None, map=openmap, rank=1)
    page.goto(f"{live_server.url}{openmap.get_absolute_url()}?edit")
    page.get_by_role("button", name="Open browser").click()
    browser = page.locator(".panel.left .umap-browser")
    datalayers = browser.locator("details.datalayer")
    expect(datalayers).to_have_count(3)

    page.get_by_role("button", name="Manage layers").click()
    dl1El = page.locator(f".panel.right li.orderable[data-id='{dl1.pk}']")
    dl2El = page.locator(f".panel.right li.orderable[data-id='{dl2.pk}']")
    dl3El = page.locator(f".panel.right li.orderable[data-id='{dl3.pk}']")

    print("##### Moving D3 inside D2")
    dragTo(page, dl3El, dl2El, "middle")
    expect(datalayers).to_have_count(3)
    expect(dl2El).to_contain_text("DL 3")

    print("##### Moving D3 before D1")
    dragTo(page, dl3El, dl1El, "above")
    expect(datalayers).to_have_count(3)
    expect(dl2El).not_to_contain_text("DL 3")

    print("##### Moving D3 inside D2")
    dragTo(page, dl3El, dl1El, "middle")
    expect(datalayers).to_have_count(3)
    expect(dl1El).to_contain_text("DL 3")
