import json
import re
from copy import deepcopy
from datetime import UTC, datetime
from pathlib import Path

import pytest
from django.utils.translation import override, to_locale
from playwright.sync_api import expect

from umap.models import Map

from ..base import DATALAYER_DATA, DataLayerFactory


@pytest.mark.django_db
def test_choose_archive_target_and_worker_moves_without_open_browser(
    map, live_server, page
):
    from django.core.management import call_command

    from umap.models import FeatureArchive

    map.edit_status = Map.ANONYMOUS
    map.save()
    source = DataLayerFactory(map=map)
    target = DataLayerFactory(
        map=map,
        name="Synthetic archive",
        data={"type": "FeatureCollection", "features": []},
    )
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit&onLoadPanel=databrowser")
    page.get_by_title("Edit this feature").click()
    page.get_by_text("Feature timing", exact=True).click()
    expect(page.locator(".umap-field-archiveLayer")).to_be_hidden()
    page.locator("select[name=expiryAction]").select_option("move")
    expect(page.get_by_label("Move on", exact=True)).to_be_visible()
    expect(page.get_by_label("Move after hiding", exact=True)).to_be_visible()
    expect(page.locator("select[name=archiveLayer] option")).to_have_count(2)
    page.locator("select[name=archiveLayer]").select_option(str(target.pk))
    page.locator("input[name=deleteOn]").fill("2000-01-01")
    page.get_by_text("Enable timing", exact=True).click()
    page.get_by_role("button", name="Use for new features in this layer").click()
    with page.expect_response(re.compile(r".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save", exact=True).click()
    source.refresh_from_db()
    assert source.settings["timingDefaults"]["archiveLayer"] == str(target.pk)
    assert source.settings["timingDefaults"]["expiryAction"] == "move"
    page.close()
    call_command("cleanup_expired_features")
    source.refresh_from_db()
    target.refresh_from_db()
    with source.geojson.open("rb") as file:
        assert not json.load(file)["features"]
    with target.geojson.open("rb") as file:
        archived = json.load(file)["features"][0]
    assert archived["properties"]["_umap_options"]["timing"]["enabled"] is False
    assert FeatureArchive.objects.filter(
        source=source, target=target, completed=True
    ).exists()


@pytest.mark.django_db
def test_old_destination_browser_cannot_drop_archived_object(map, live_server, page):
    from umap.feature_timing import cleanup_layer

    map.edit_status = Map.ANONYMOUS
    map.save()
    target = DataLayerFactory(map=map, name="Synthetic destination")
    data = deepcopy(DATALAYER_DATA)
    data["features"][0]["id"] = "ARCH1"
    data["features"][0]["properties"]["_umap_options"]["timing"] = {
        "enabled": True,
        "deleteOn": "2000-01-01",
        "expiryAction": "move",
        "archiveLayer": str(target.pk),
    }
    source = DataLayerFactory(map=map, data=data)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit&onLoadPanel=databrowser")
    page.get_by_role("button", name="Manage layers").click()
    page.locator(f'.panel.right summary[data-id="{target.pk}"]').get_by_title(
        "Edit", exact=True
    ).click()
    # Editing the layer itself is sufficient to exercise a stale destination save.
    expect(page.locator("input[name=name]")).to_be_visible()
    assert cleanup_layer(source.pk, datetime.now(UTC)) == 1
    page.locator("input[name=name]").fill("Synthetic stale destination")
    page.locator("input[name=name]").blur()
    expect(page.get_by_role("button", name="Save", exact=True)).to_be_enabled()
    page.get_by_role("button", name="Save", exact=True).click()
    expect(
        page.get_by_text("This layer changed and uses automatic cleanup.", exact=False)
    ).to_be_visible()
    target.refresh_from_db()
    with target.geojson.open("rb") as file:
        assert len(json.load(file)["features"]) == 2


@pytest.mark.django_db
def test_layer_timing_preset_keeps_existing_features_untouched(map, live_server, page):
    map.edit_status = Map.ANONYMOUS
    map.save()
    layer = DataLayerFactory(map=map)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit&onLoadPanel=databrowser")
    page.get_by_role("button", name="Manage layers").click()
    page.locator(".panel.right").get_by_title("Edit", exact=True).click()
    page.get_by_text("Feature timing", exact=True).click()
    page.locator("input[name=hideOn]").fill("{Bingo}")
    page.locator("input[name=deleteAfter]").fill("7")
    page.get_by_text("Enable timing", exact=True).click()
    with page.expect_response(re.compile(r".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save", exact=True).click()
    layer.refresh_from_db()
    assert layer.settings["timingDefaults"] == {
        "enabled": True,
        "hideOn": "{Bingo}",
        "deleteAfter": 7,
    }
    with layer.geojson.open("rb") as source:
        before = json.load(source)["features"]
    assert "timing" not in before[0]["properties"]["_umap_options"]
    # Reloading ordinary objects must not silently apply the new template.
    page.reload()
    page.get_by_role("button", name="Edit", exact=True).click()
    page.get_by_title("Edit this feature").click()
    page.locator("input[name=name]").fill("Still untimed")
    page.locator("input[name=name]").blur()
    with page.expect_response(re.compile(r".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save", exact=True).click()
    layer.refresh_from_db()
    with layer.geojson.open("rb") as source:
        after = json.load(source)["features"]
    assert "timing" not in after[0]["properties"]["_umap_options"]


@pytest.mark.django_db
def test_column_schedule_and_layer_preset_for_next_marker(map, live_server, page):
    map.edit_status = Map.ANONYMOUS
    map.save()
    data = deepcopy(DATALAYER_DATA)
    data["features"][0]["properties"]["Bingo"] = "15.11.2026"
    layer = DataLayerFactory(map=map, data=data)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit&onLoadPanel=databrowser")
    page.get_by_title("Edit this feature").click()
    page.get_by_text("Feature timing", exact=True).click()
    page.locator("input[name=hideOn]").fill("{Bingo}")
    page.locator("input[name=hideOn]").blur()
    expect(page.locator("input[name=hideOn]")).to_have_value("{Bingo}")
    page.locator("input[name=deleteAfter]").fill("3")
    page.locator("select[name=deleteUnit]").select_option("months")
    page.get_by_text("Enable timing", exact=True).click()
    expect(page.locator(".timing-status")).to_contain_text("2027-02-15")
    expect(page.locator("input[name=deleteOn]")).not_to_have_attribute("required", "")
    expect(page.locator(".umap-field-deleteOn .help-text")).to_be_hidden()
    page.locator("input[name=Bingo]").fill("16.12.2026")
    page.locator("input[name=Bingo]").blur()
    expect(page.locator(".timing-status")).to_contain_text("2027-03-16")
    page.get_by_role("button", name="Use for new features in this layer").click()
    with page.expect_response(re.compile(r".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save", exact=True).click()
    layer.refresh_from_db()
    assert layer.settings["timingDefaults"] == {
        "enabled": True,
        "hideOn": "{Bingo}",
        "deleteAfter": 3,
        "deleteUnit": "months",
    }
    page.locator("body").press("Escape")
    expect(page.locator(".panel.right")).to_be_hidden()
    page.get_by_title("Draw a marker").click()
    # Draw on exposed map canvas, outside the still-open data browser.
    page.locator("#map").click(position={"x": 600, "y": 220})
    expect(page.locator("input[name=name]")).to_have_value("")
    page.get_by_text("Feature timing", exact=True).click()
    expect(page.locator("input[name=hideOn]")).to_have_value("{Bingo}")
    expect(page.locator("input[name=deleteAfter]")).to_have_value("3")
    expect(page.locator("select[name=deleteUnit]")).to_have_value("months")
    expect(page.get_by_label("Enable timing", exact=True)).to_be_checked()
    # A new marker with an empty date may be saved, but has no active deadline yet.
    expect(page.locator(".timing-status")).to_contain_text("—")
    with page.expect_response(re.compile(r".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save", exact=True).click()
    layer.refresh_from_db()
    with layer.geojson.open("rb") as source:
        features = json.load(source)["features"]
    assert len(features) == 2
    assert all(
        f["properties"]["_umap_options"]["timing"]["deleteAfter"] == 3 for f in features
    )


@pytest.mark.django_db
def test_reference_schedule_hides_when_column_changes(map, live_server, page):
    map.edit_status = Map.ANONYMOUS
    map.save()
    data = deepcopy(DATALAYER_DATA)
    data["features"][0]["properties"].update(
        {
            "Bingo": "01.01.2030",
            "_umap_options": {
                "timing": {"enabled": True, "hideOn": "{Bingo}", "deleteAfter": 7}
            },
        }
    )
    DataLayerFactory(map=map, data=data)
    page.clock.install(time=datetime(2030, 1, 1, 23, 59, 58, tzinfo=UTC))
    page.clock.pause_at(datetime(2030, 1, 1, 23, 59, 59, tzinfo=UTC))
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit&onLoadPanel=databrowser")
    page.get_by_title("Edit this feature").click()
    page.locator("input[name=Bingo]").fill("02.01.2030")
    page.locator("input[name=Bingo]").blur()
    with page.expect_response(re.compile(r".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save", exact=True).click()
    page.locator("body").press("Escape")
    page.get_by_role("button", name="View", exact=True).click()
    if not page.locator(".umap-browser").is_visible():
        page.get_by_title("Open browser", exact=True).click()
    expect(page.locator(".umap-browser .feature.marker")).to_have_count(1)
    page.clock.fast_forward(1100)
    expect(page.locator(".umap-browser .feature.marker")).to_have_count(0)


@pytest.mark.django_db
@pytest.mark.parametrize("language", ["de", "fr", "ar", "ja"])
def test_timing_controls_are_localized(map, live_server, page, language):
    map.edit_status = Map.ANONYMOUS
    map.save()
    DataLayerFactory(map=map)
    catalog = json.loads(
        (
            Path(__file__).resolve().parents[2]
            / "static/umap/locale"
            / f"{to_locale(language)}.json"
        ).read_text(encoding="utf-8")
    )
    with override(language):
        url = map.get_absolute_url()
    page.goto(f"{live_server.url}{url}?edit&onLoadPanel=databrowser")
    page.locator(".umap-browser .feature .icon-edit").click()
    page.get_by_role("heading", name=catalog["Feature timing"], exact=True).click()
    expect(page.get_by_label(catalog["Delete on"], exact=True)).to_be_visible()
    expect(
        page.get_by_label(catalog["Hide from (optional)"], exact=True)
    ).to_be_visible()
    expect(page.get_by_label(catalog["Enable timing"], exact=True)).not_to_be_checked()
    if language == "ar":
        expect(page.locator("html")).to_have_attribute("dir", "rtl")
    page.locator("select[name=expiryAction]").select_option("move")
    expect(page.get_by_label(catalog["Move on"], exact=True)).to_be_visible()
    expect(page.get_by_label(catalog["Move after hiding"], exact=True)).to_be_visible()


@pytest.mark.django_db
def test_editing_an_ordinary_feature_does_not_create_timing(map, live_server, page):
    import json

    map.edit_status = Map.ANONYMOUS
    map.save()
    layer = DataLayerFactory(map=map)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit&onLoadPanel=databrowser")
    page.get_by_title("Edit this feature").click()
    page.locator("input[name=name]").fill("Synthetic untimed edit")
    page.locator("input[name=name]").blur()
    with page.expect_response(re.compile(r".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save", exact=True).click()
    layer.refresh_from_db()
    with layer.geojson.open("rb") as source:
        feature = json.load(source)["features"][0]
    assert "timing" not in feature["properties"].get("_umap_options", {})


@pytest.mark.django_db
def test_first_timing_change_supports_undo_redo_and_disable(map, live_server, page):
    import json

    map.edit_status = Map.ANONYMOUS
    map.save()
    layer = DataLayerFactory(map=map)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit&onLoadPanel=databrowser")

    def open_fields():
        page.get_by_title("Edit this feature").click()
        page.get_by_text("Feature timing", exact=True).click()

    open_fields()
    page.locator("input[name=deleteOn]").fill("2031-01-02")
    page.locator("input[name=deleteOn]").blur()
    expect(page.locator(".edit-undo")).to_be_enabled()
    page.locator(".edit-undo").click()
    page.locator("body").press("Escape")
    open_fields()
    expect(page.locator("input[name=deleteOn]")).to_have_value("")
    page.locator(".edit-redo").click()
    page.locator("body").press("Escape")
    open_fields()
    expect(page.locator("input[name=deleteOn]")).to_have_value("2031-01-02")
    page.get_by_text("Enable timing", exact=True).click()
    expect(page.locator("input[name=deleteOn]")).to_have_attribute("required", "")
    with page.expect_response(re.compile(r".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save", exact=True).click()
    layer.refresh_from_db()
    with layer.geojson.open("rb") as source:
        timing = json.load(source)["features"][0]["properties"]["_umap_options"][
            "timing"
        ]
    assert timing == {"enabled": True, "deleteOn": "2031-01-02"}
    page.get_by_text("Enable timing", exact=True).click()
    expect(page.locator("input[name=deleteOn]")).not_to_have_attribute("required", "")
    with page.expect_response(re.compile(r".*/datalayer/update/.*")):
        page.get_by_role("button", name="Save", exact=True).click()
    layer.refresh_from_db()
    with layer.geojson.open("rb") as source:
        timing = json.load(source)["features"][0]["properties"]["_umap_options"][
            "timing"
        ]
    assert timing == {"enabled": False, "deleteOn": "2031-01-02"}


@pytest.mark.django_db
def test_hidden_feature_remains_editable(map, live_server, page):
    map.edit_status = Map.ANONYMOUS
    map.save()
    data = deepcopy(DATALAYER_DATA)
    data["features"][0]["properties"]["_umap_options"]["timing"] = {
        "enabled": True,
        "hideOn": "2000-01-01",
        "deleteOn": "2099-01-01",
    }
    DataLayerFactory(map=map, data=data)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?onLoadPanel=databrowser")
    expect(page.locator(".umap-browser .feature.marker")).to_have_count(0)
    # Anonymous map editing is granted by the fixture's layer/map settings.
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit&onLoadPanel=databrowser")
    expect(page.locator("body")).to_have_class(re.compile(".*umap-edit-enabled.*"))
    expect(page.locator(".umap-browser .feature.marker")).to_have_count(1)
    page.get_by_title("Edit this feature").click()
    page.get_by_text("Feature timing", exact=True).click()
    expect(page.locator("input[name=hideOn]")).to_have_value("2000-01-01")
    expect(page.locator("input[name=deleteOn]")).to_have_value("2099-01-01")


@pytest.mark.django_db
@pytest.mark.parametrize("hide_on", [None, "2030-01-02"])
def test_open_view_hides_at_utc_midnight(map, live_server, page, hide_on):
    data = deepcopy(DATALAYER_DATA)
    data["features"][0]["properties"]["_umap_options"]["timing"] = {
        "enabled": True,
        "hideOn": hide_on,
        "deleteOn": "2030-01-03" if hide_on else "2030-01-02",
    }
    DataLayerFactory(map=map, data=data)
    page.clock.install(time=datetime(2030, 1, 1, 23, 59, 58, tzinfo=UTC))
    page.clock.pause_at(datetime(2030, 1, 1, 23, 59, 59, tzinfo=UTC))
    page.goto(f"{live_server.url}{map.get_absolute_url()}?onLoadPanel=databrowser")
    expect(page.locator(".umap-browser .feature.marker")).to_have_count(1)
    page.clock.fast_forward(1100)
    expect(page.locator(".umap-browser .feature.marker")).to_have_count(0)


@pytest.mark.django_db
def test_old_browser_cannot_undo_background_cleanup(map, live_server, page):
    import json

    from django.core.management import call_command

    map.edit_status = Map.ANONYMOUS
    map.save()
    data = deepcopy(DATALAYER_DATA)
    data["features"][0]["properties"]["_umap_options"]["timing"] = {
        "enabled": True,
        "deleteOn": "2000-01-01",
    }
    layer = DataLayerFactory(map=map, data=data)
    page.goto(f"{live_server.url}{map.get_absolute_url()}?edit&onLoadPanel=databrowser")
    page.get_by_title("Edit this feature").click()
    call_command("cleanup_expired_features")
    page.locator("input[name=name]").fill("Synthetic stale edit")
    page.locator("input[name=name]").blur()
    page.get_by_role("button", name="Save", exact=True).click()
    expect(
        page.get_by_text("This layer changed and uses automatic cleanup.", exact=False)
    ).to_be_visible()
    layer.refresh_from_db()
    with layer.geojson.open("rb") as source:
        assert not json.load(source)["features"]
