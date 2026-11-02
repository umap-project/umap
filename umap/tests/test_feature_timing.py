import json
from copy import deepcopy
from datetime import UTC, datetime, timedelta, timezone
from io import StringIO

import pytest
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.urls import reverse

from umap.feature_timing import cleanup_layer, resolve_timing, validate_timing
from umap.models import DataLayer, ExpiredFeature

from .base import DATALAYER_DATA, DataLayerFactory


def document(**timing):
    data = deepcopy(DATALAYER_DATA)
    data["features"][0]["properties"]["_umap_options"]["timing"] = {
        "enabled": True,
        "deleteOn": "2030-01-02",
        **timing,
    }
    return data


def read(layer):
    layer.refresh_from_db()
    with layer.geojson.open("rb") as source:
        return json.load(source)


def upload(client, layer, data, ref=None):
    client.force_login(layer.map.owner)
    headers = {"X-Datalayer-Reference": ref} if ref is not None else {}
    headers["X-Umap-Archive-Generation"] = str(data.get("archiveGeneration", 0))
    return client.post(
        reverse("datalayer_update", args=[layer.map_id, layer.pk]),
        {
            "name": layer.name,
            "rank": 0,
            "settings": json.dumps(layer.settings),
            "geojson": SimpleUploadedFile(
                "synthetic.geojson", json.dumps(data).encode()
            ),
        },
        headers=headers,
    )


@pytest.mark.parametrize(
    "value",
    [
        "2030-02-30",
        "2030-13-01",
        "30/01/2030",
        "2030-01-02T00:00:00Z",
        "0000-01-01",
        True,
        1,
        [],
        {},
    ],
)
def test_invalid_dates(value):
    with pytest.raises(ValidationError):
        validate_timing(document(deleteOn=value))


@pytest.mark.parametrize(
    "timing", [{"deleteOn": None}, {"hideOn": "2030-01-03"}, {"enabled": "true"}]
)
def test_invalid_schedule(timing):
    with pytest.raises(ValidationError):
        validate_timing(document(**timing))


def test_optional_hide_and_disabled():
    assert validate_timing(document())
    assert not validate_timing(document(enabled=False, deleteOn=None))
    assert validate_timing(document(hideOn="2030-01-02"))
    assert validate_timing(document(deleteOn="2032-02-29"))
    assert not validate_timing(DATALAYER_DATA)


@pytest.mark.parametrize("value", ["2026-11-15", "15.11.2026"])
def test_field_reference_and_three_calendar_months(value):
    from datetime import date

    timing = {
        "enabled": True,
        "hideOn": "{Ende}",
        "deleteAfter": 3,
        "deleteUnit": "months",
    }
    assert resolve_timing(timing, {"Ende": value}) == (
        date(2026, 11, 15),
        date(2027, 2, 15),
    )
    assert resolve_timing(timing, {"Ende": ""}) == (None, None)
    assert resolve_timing(timing, {}) == (None, None)
    assert resolve_timing(timing) == (None, None)  # Layer template.


@pytest.mark.parametrize(
    "field", ["Bingo", "Ende der Baustelle", "Datum.Ende", "_Datum", "終了日"]
)
def test_arbitrary_exact_column_names(field):
    from datetime import date

    timing = {"enabled": True, "hideOn": "{" + field + "}", "deleteAfter": 7}
    assert resolve_timing(timing, {field: "15.11.2026"}) == (
        date(2026, 11, 15),
        date(2026, 11, 22),
    )


@pytest.mark.parametrize(
    "start,amount,unit,end",
    [
        ("2027-01-31", 1, "months", "2027-02-28"),
        ("2028-01-31", 1, "months", "2028-02-29"),
        ("2028-02-29", 12, "months", "2029-02-28"),
        ("2026-12-29", 7, "days", "2027-01-05"),
    ],
)
def test_retention_boundaries(start, amount, unit, end):
    from datetime import date

    assert resolve_timing(
        {"enabled": True, "hideOn": start, "deleteAfter": amount, "deleteUnit": unit},
        {},
    )[1] == date.fromisoformat(end)


@pytest.mark.parametrize(
    "overrides,properties",
    [
        ({}, {"Ende": "31.02.2026"}),
        ({}, {"Ende": "{Other}"}),
        ({"hideOn": "{_umap_options}"}, {"_umap_options": {}}),
        ({"hideOn": "prefix {Ende}"}, {}),
        ({"deleteAfter": 0}, {}),
        ({"deleteAfter": -1}, {}),
        ({"deleteAfter": True}, {}),
        ({"deleteAfter": 1.5}, {}),
        ({"deleteAfter": "3"}, {}),
        ({"deleteUnit": "years"}, {}),
        ({"hideOn": "9999-12-31"}, {}),
        ({"hideOn": None}, {}),
        ({"deleteOn": "2027-01-01"}, {}),
    ],
)
def test_invalid_reference_or_retention(overrides, properties):
    timing = {
        "enabled": True,
        "hideOn": "{Ende}",
        "deleteAfter": 3,
        "deleteUnit": "months",
        **overrides,
    }
    with pytest.raises(ValidationError):
        resolve_timing(timing, properties)


@pytest.mark.django_db
def test_calculated_cleanup_reschedule_pending_and_stale_restore(client, map):
    data = document(hideOn="{Ende}", deleteOn=None, deleteAfter=3, deleteUnit="months")
    feature = data["features"][0]
    feature["properties"]["Ende"] = "15.11.2026"
    layer = DataLayerFactory(map=map, data=data)
    ref = layer.reference_version
    assert cleanup_layer(layer.pk, datetime(2027, 2, 14, 23, 59, 59, tzinfo=UTC)) == 0
    # A normal attribute edit automatically moves the deletion deadline.
    feature["properties"]["Ende"] = "15.12.2026"
    assert "error" not in upload(client, layer, data, ref).json()
    assert cleanup_layer(layer.pk, datetime(2027, 2, 15, tzinfo=UTC)) == 0
    layer = DataLayer.objects.get(pk=layer.pk)
    feature["properties"]["Ende"] = ""
    assert "error" not in upload(client, layer, data, layer.reference_version).json()
    assert cleanup_layer(layer.pk, datetime(2027, 3, 15, tzinfo=UTC)) == 0
    layer = DataLayer.objects.get(pk=layer.pk)
    feature["properties"]["Ende"] = "15.11.2026"
    assert "error" not in upload(client, layer, data, layer.reference_version).json()
    assert cleanup_layer(layer.pk, datetime(2027, 2, 15, tzinfo=UTC)) == 1
    layer = DataLayer.objects.get(pk=layer.pk)
    assert "error" in upload(client, layer, data, layer.reference_version).json()


@pytest.mark.django_db
def test_invalid_layer_template_is_rejected(client, map):
    layer = DataLayerFactory(map=map)
    layer.settings["timingDefaults"] = {
        "enabled": True,
        "hideOn": "{Ende}",
        "deleteAfter": -3,
    }
    assert (
        "error" in upload(client, layer, DATALAYER_DATA, layer.reference_version).json()
    )


def test_timed_ids_are_stable_and_unique():
    data = document()
    data["features"].append(deepcopy(data["features"][0]))
    with pytest.raises(ValidationError):
        validate_timing(data)
    data = document()
    del data["features"][0]["id"]
    with pytest.raises(ValidationError):
        validate_timing(data)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "geometry",
    [
        {"type": "Point", "coordinates": [0, 0]},
        {"type": "LineString", "coordinates": [[0, 0], [1, 1]]},
        {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]},
    ],
)
def test_utc_boundary_and_version_retention(map, settings, geometry):
    settings.UMAP_KEEP_VERSIONS = 10
    data = document()
    data["features"][0]["geometry"] = geometry
    layer = DataLayerFactory(map=map, data=data)
    original = layer.reference_version
    assert cleanup_layer(layer.pk, datetime(2030, 1, 1, 23, 59, 59, tzinfo=UTC)) == 0
    assert (
        cleanup_layer(
            layer.pk,
            datetime(2030, 1, 2, 1, 59, 59, tzinfo=timezone(timedelta(hours=2))),
        )
        == 0
    )
    assert cleanup_layer(layer.pk, datetime(2030, 1, 2, tzinfo=UTC)) == 1
    assert not read(layer)["features"]
    assert json.loads(layer.get_version(original))["features"] == data["features"]
    assert ExpiredFeature.objects.filter(datalayer=layer).count() == 1
    assert cleanup_layer(layer.pk, datetime(2030, 1, 3, tzinfo=UTC)) == 0


@pytest.mark.django_db
def test_only_due_features_and_original_layer(map):
    data = document()
    untouched = deepcopy(data["features"][0])
    untouched["id"] = "other"
    untouched["properties"]["_umap_options"]["timing"]["enabled"] = False
    data["features"].append(untouched)
    layer = DataLayerFactory(map=map, data=data)
    other_layer = DataLayerFactory(map=map, data=data)
    assert cleanup_layer(layer.pk, datetime(2030, 1, 2, tzinfo=UTC)) == 1
    assert [f["id"] for f in read(layer)["features"]] == ["other"]
    assert len(read(other_layer)["features"]) == 2


@pytest.mark.django_db
def test_reschedule_and_disable(client, map):
    layer = DataLayerFactory(map=map, data=document())
    response = upload(
        client, layer, document(deleteOn="2030-03-01"), layer.reference_version
    )
    assert response.status_code == 200 and "error" not in response.json()
    assert cleanup_layer(layer.pk, datetime(2030, 1, 2, tzinfo=UTC)) == 0
    layer = DataLayer.objects.get(pk=layer.pk)
    response = upload(client, layer, document(enabled=False), layer.reference_version)
    assert "error" not in response.json()
    assert cleanup_layer(layer.pk, datetime(2031, 1, 2, tzinfo=UTC)) == 0


@pytest.mark.django_db
def test_rejects_stale_editor_and_force_save(client, map):
    layer = DataLayerFactory(map=map, data=document())
    original = layer.reference_version
    assert cleanup_layer(layer.pk, datetime(2030, 1, 2, tzinfo=UTC)) == 1
    for ref in [original, None]:
        response = upload(
            client, layer, document(enabled=False, deleteOn="2099-01-01"), ref
        )
        assert response.status_code == 412
        assert response["X-Umap-Timing-Conflict"] == "reload"
    # Even a refreshed reference, realtime peers or a restored historical file
    # cannot reuse a deleted ID, irrespective of its changed or removed dates.
    layer = DataLayer.objects.get(pk=layer.pk)
    for incoming in [document(enabled=False), deepcopy(DATALAYER_DATA)]:
        response = upload(client, layer, incoming, layer.reference_version)
        assert "error" in response.json()
        assert not read(layer)["features"]


@pytest.mark.django_db
def test_invalid_upload_does_not_change_file(client, map):
    layer = DataLayerFactory(map=map, data=document())
    original = layer.geojson.name
    response = upload(
        client, layer, document(deleteOn="2030-02-30"), layer.reference_version
    )
    assert "error" in response.json()
    layer.refresh_from_db()
    assert layer.geojson.name == original


@pytest.mark.django_db
def test_command_without_browser_and_dry_run(map):
    layer = DataLayerFactory(map=map, data=document(deleteOn="2000-01-01"))
    original = layer.geojson.name
    output = StringIO()
    call_command("cleanup_expired_features", dry_run=True, stdout=output)
    assert "Due features: 1" in output.getvalue()
    assert read(layer)["features"]
    assert layer.geojson.name == original
    call_command("cleanup_expired_features", stdout=StringIO())
    assert not read(layer)["features"]


@pytest.mark.django_db
def test_route_cleanup_keeps_deletion_id_after_versions_are_purged(
    client, map, settings
):
    data = document(deleteOn="2000-01-01")
    feature = data["features"][0]
    feature["geometry"] = {"type": "LineString", "coordinates": [[0, 0], [1, 1]]}
    feature["properties"]["_umap_options"]["route"] = {"coordinates": [[0, 0], [1, 1]]}
    layer = DataLayerFactory(map=map, data=data)
    assert cleanup_layer(layer.pk) == 1
    read(layer)
    layer.geojson.storage.purge_old_versions(layer, keep=0)
    layer = DataLayer.objects.get(pk=layer.pk)
    assert "error" in upload(client, layer, data, layer.reference_version).json()
    assert not read(layer)["features"]


@pytest.mark.django_db(transaction=True)
def test_cleanup_waits_for_concurrent_reschedule(map):
    from concurrent.futures import ThreadPoolExecutor, TimeoutError
    from threading import Event

    from django.db import connections, transaction

    from umap.models import DataLayer

    layer = DataLayerFactory(map=map, data=document())
    started = Event()

    def cleanup():
        try:
            started.set()
            return cleanup_layer(layer.pk, datetime(2030, 1, 2, tzinfo=UTC))
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=1) as executor:
        with transaction.atomic():
            locked = DataLayer.objects.select_for_update().get(pk=layer.pk)
            future = executor.submit(cleanup)
            assert started.wait(5)
            with pytest.raises(TimeoutError):
                future.result(timeout=0.1)
            locked.geojson.save(
                "rescheduled.geojson",
                ContentFile(json.dumps(document(deleteOn="2030-03-01")).encode()),
            )
        assert future.result(timeout=10) == 0
    assert read(layer)["features"]
