import json
from datetime import UTC, datetime, timedelta, timezone

import pytest
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile

from umap.feature_archiving import prepare_archives
from umap.feature_timing import cleanup_layer
from umap.models import DataLayer, ExpiredFeature, FeatureArchive

from .base import DataLayerFactory, MapFactory
from .test_feature_timing import document, read, upload


def pair(map, **timing):
    target = DataLayerFactory(
        map=map, data={"type": "FeatureCollection", "features": []}
    )
    data = document(expiryAction="move", archiveLayer=str(target.pk), **timing)
    data["features"][0]["properties"]["Bingo"] = "01.01.2030"
    source = DataLayerFactory(map=map, data=data)
    return source, target, data


@pytest.mark.django_db
@pytest.mark.parametrize(
    "geometry,route",
    [
        ({"type": "Point", "coordinates": [0, 0]}, False),
        ({"type": "LineString", "coordinates": [[0, 0], [1, 1]]}, False),
        ({"type": "LineString", "coordinates": [[0, 0], [1, 1]]}, True),
        ({"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}, False),
    ],
)
def test_move_at_expiry_keeps_data_and_versions_and_disables_timing(
    map, settings, geometry, route
):
    settings.UMAP_KEEP_VERSIONS = 10
    source, target, data = pair(map)
    original = data["features"][0]
    original["geometry"] = geometry
    if route:
        original["properties"]["_umap_options"]["route"] = {
            "coordinates": [[0, 0], [1, 1]]
        }
    source.settings.setdefault("fields", []).append({"key": "Bingo", "type": "Date"})
    source.save(update_fields=["settings"])
    source.geojson.save("shape.geojson", ContentFile(json.dumps(data).encode()))
    old_source, old_target = source.reference_version, target.reference_version
    assert cleanup_layer(source.pk, datetime(2030, 1, 1, 23, 59, 59, tzinfo=UTC)) == 0
    assert (
        cleanup_layer(
            source.pk,
            datetime(2030, 1, 2, 1, 59, 59, tzinfo=timezone(timedelta(hours=2))),
        )
        == 0
    )
    assert cleanup_layer(source.pk, datetime(2030, 1, 2, tzinfo=UTC)) == 1
    assert not read(source)["features"]
    archived = read(target)["features"][0]
    assert archived["id"] == original["id"]
    assert archived["geometry"] == original["geometry"]
    assert archived["properties"]["Bingo"] == original["properties"]["Bingo"]
    assert {"key": "Bingo", "type": "Date"} in target.settings["fields"]
    if route:
        assert (
            archived["properties"]["_umap_options"]["route"]
            == original["properties"]["_umap_options"]["route"]
        )
    assert archived["properties"]["_umap_options"]["timing"]["enabled"] is False
    assert "expiryAction" not in archived["properties"]["_umap_options"]["timing"]
    job = FeatureArchive.objects.get(source=source)
    assert job.completed and job.payload == {}
    assert archived["properties"]["_umap_options"]["timingArchive"]["transfer"] == str(
        job.pk
    )
    assert json.loads(source.get_version(old_source))["features"] == data["features"]
    assert not json.loads(target.get_version(old_target))["features"]
    assert cleanup_layer(source.pk, datetime(2031, 1, 2, tzinfo=UTC)) == 0
    assert cleanup_layer(target.pk, datetime(2031, 1, 2, tzinfo=UTC)) == 0
    assert len(read(target)["features"]) == 1


@pytest.mark.django_db
def test_archive_stale_editors_and_current_reference_resurrection(client, map):
    source, target, data = pair(map)
    source_ref, target_ref = source.reference_version, target.reference_version
    stale_target = read(target)
    assert cleanup_layer(source.pk, datetime(2030, 1, 2, tzinfo=UTC)) == 1
    assert upload(client, source, data, source_ref).status_code == 412
    assert upload(client, target, stale_target, target_ref).status_code == 412
    fresh_source = DataLayer.objects.get(pk=source.pk)
    assert (
        "error"
        in upload(client, fresh_source, data, fresh_source.reference_version).json()
    )
    fresh_target = DataLayer.objects.get(pk=target.pk)
    # A websocket may have advanced referenceVersion without delivering the
    # archived feature. A current version alone must not authorize dropping it.
    assert (
        upload(
            client, fresh_target, stale_target, fresh_target.reference_version
        ).status_code
        == 412
    )
    current = read(fresh_target)
    assert current["archiveGeneration"] == fresh_target.archive_generation == 1
    current["features"][0]["properties"]["name"] = "Editable archive"
    assert (
        "error"
        not in upload(
            client, fresh_target, current, fresh_target.reference_version
        ).json()
    )
    assert read(fresh_target)["features"][0]["properties"]["name"] == "Editable archive"


@pytest.mark.django_db
def test_archive_reschedule_and_dry_run_have_no_side_effects(client, map):
    source, target, data = pair(map, deleteOn="{Bingo}")
    assert cleanup_layer(source.pk, datetime(2030, 1, 1, tzinfo=UTC), dry_run=True) == 1
    assert not FeatureArchive.objects.exists()
    assert read(source)["features"] and not read(target)["features"]
    data["features"][0]["properties"]["Bingo"] = "02.01.2030"
    assert "error" not in upload(client, source, data, source.reference_version).json()
    assert cleanup_layer(source.pk, datetime(2030, 1, 1, tzinfo=UTC)) == 0
    assert cleanup_layer(source.pk, datetime(2030, 1, 2, tzinfo=UTC)) == 1


@pytest.mark.django_db
def test_failed_copy_or_removal_is_retryable_and_blocks_both_editors(
    client, map, monkeypatch
):
    from umap import feature_archiving

    source, target, data = pair(map)
    write = feature_archiving.write_layer

    def fail_removal(layer, *args, **kwargs):
        if layer.pk == source.pk:
            raise OSError("Synthetic storage interruption")
        return write(layer, *args, **kwargs)

    monkeypatch.setattr(feature_archiving, "write_layer", fail_removal)
    with pytest.raises(OSError):
        cleanup_layer(source.pk, datetime(2030, 1, 2, tzinfo=UTC))
    assert read(source)["features"]
    assert FeatureArchive.objects.filter(completed=False).exists()
    assert upload(client, source, data, source.reference_version).status_code == 412
    assert (
        upload(client, target, read(target), target.reference_version).status_code
        == 412
    )
    monkeypatch.setattr(feature_archiving, "write_layer", write)
    assert cleanup_layer(source.pk, datetime(2030, 1, 2, tzinfo=UTC)) == 1
    assert not read(source)["features"] and len(read(target)["features"]) == 1
    assert not FeatureArchive.objects.filter(completed=False).exists()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "kind",
    [
        "self",
        "foreign",
        "deleted",
        "remote",
        "group",
        "restricted",
        "collision",
        "expired_id",
    ],
)
def test_invalid_targets_never_delete_source(client, map, kind):
    source, target, data = pair(map)
    if kind == "self":
        data["features"][0]["properties"]["_umap_options"]["timing"]["archiveLayer"] = (
            str(source.pk)
        )
    elif kind == "foreign":
        target.map = MapFactory()
        target.save()
    elif kind == "deleted":
        target.share_status = DataLayer.DELETED
        target.save()
    elif kind == "remote":
        target.settings["remoteData"] = {
            "url": "https://example.invalid/synthetic.geojson"
        }
        target.save()
    elif kind == "group":
        target.settings["group"] = True
        target.save()
    elif kind == "restricted":
        source.edit_status = DataLayer.ANONYMOUS
        source.save()
        target.edit_status = DataLayer.OWNER
        target.save()
    elif kind == "collision":
        target.geojson.save("collision.geojson", ContentFile(json.dumps(data).encode()))
    else:
        ExpiredFeature.objects.create(
            datalayer=target, feature_id=data["features"][0]["id"]
        )
    # Save validation is checked for invalid references/permissions, while
    # collisions are detected by the worker against the latest destination.
    if kind not in ("collision", "expired_id"):
        assert "error" in upload(client, source, data, source.reference_version).json()
    if kind == "self":
        source.geojson.save("invalid.geojson", ContentFile(json.dumps(data).encode()))
    with pytest.raises(ValidationError):
        cleanup_layer(source.pk, datetime(2030, 1, 2, tzinfo=UTC))
    assert read(source)["features"]
    assert not FeatureArchive.objects.exists()


@pytest.mark.django_db
def test_target_permission_changes_before_worker_are_honoured(map):
    source, target, data = pair(map)
    source.edit_status = DataLayer.ANONYMOUS
    source.save()
    target.edit_status = DataLayer.ANONYMOUS
    target.save()
    assert (
        prepare_archives(source.pk, datetime(2030, 1, 2, tzinfo=UTC), dry_run=True) == 1
    )
    target.edit_status = DataLayer.OWNER
    target.save()
    with pytest.raises(ValidationError):
        cleanup_layer(source.pk, datetime(2030, 1, 2, tzinfo=UTC))
    assert read(source)["features"] and not read(target)["features"]


@pytest.mark.django_db(transaction=True)
def test_two_workers_move_exactly_once(map):
    from concurrent.futures import ThreadPoolExecutor

    from django.db import connections

    source, target, data = pair(map)

    def run():
        try:
            return cleanup_layer(source.pk, datetime(2030, 1, 2, tzinfo=UTC))
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(run) for _ in range(2)]
        assert sorted(future.result(timeout=20) for future in futures) == [0, 1]
    assert not read(source)["features"]
    assert len(read(target)["features"]) == 1
    assert FeatureArchive.objects.filter(completed=True).count() == 1


@pytest.mark.django_db
def test_client_cannot_seed_a_future_archive_generation(client, map):
    source, target, data = pair(map)
    data["archiveGeneration"] = 1
    assert "error" in upload(client, source, data, source.reference_version).json()
    assert DataLayer.objects.get(pk=source.pk).archive_generation == 0
