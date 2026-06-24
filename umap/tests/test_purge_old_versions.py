from datetime import datetime, timedelta
from pathlib import Path
from unittest import mock

import pytest
from django.core.files.base import ContentFile
from django.core.management import call_command

from .base import DataLayerFactory, MapFactory

pytestmark = pytest.mark.django_db


def test_purge_old_versions(map):
    map2 = MapFactory()
    other_layer = DataLayerFactory(map=map2)
    recent_layer = DataLayerFactory(map=map)
    old_layer = DataLayerFactory(map=map)
    older_layer = DataLayerFactory(map=map)
    other_layer.geojson.storage.save(
        Path(other_layer.geojson.storage._base_path(other_layer))
        / f"{other_layer.uuid}_1440918537.geojson",
        ContentFile("{}"),
    )
    with mock.patch("django.utils.timezone.now") as mocked:
        mocked.return_value = datetime.utcnow() - timedelta(days=7)
        old_layer.save()
        old_layer.geojson.storage.save(
            Path(old_layer.geojson.storage._base_path(old_layer))
            / f"{old_layer.uuid}_1440918537.geojson",
            ContentFile("{}"),
        )
        old_layer.geojson.storage.save(
            Path(old_layer.geojson.storage._base_path(old_layer))
            / f"{old_layer.uuid}_1440918537.geojson.gz",
            ContentFile("{}"),
        )
        mocked.return_value = datetime.utcnow() - timedelta(days=12)
        older_layer.save()
        older_layer.geojson.storage.save(
            Path(older_layer.geojson.storage._base_path(older_layer))
            / f"{older_layer.uuid}_1340918536.geojson",
            ContentFile("{}"),
        )
        older_layer.geojson.storage.save(
            Path(older_layer.geojson.storage._base_path(older_layer))
            / f"{older_layer.uuid}_1340918536.geojson.gz",
            ContentFile("{}"),
        )
    assert len(recent_layer.versions) == 1
    assert len(old_layer.versions) == 2
    assert len(older_layer.versions) == 2
    assert len(other_layer.versions) == 2
    root = old_layer.geojson.storage._base_path(old_layer)
    # Files including gz for map 1
    # recent layer geojson
    # old layer 2 geojson + 1 gzip
    # older layer 2 geojson + 1 gzip
    assert len(old_layer.geojson.storage.listdir(root)[1]) == 7
    call_command("purge_old_versions", "--days-ago=7", "--dry-run")
    assert len(recent_layer.versions) == 1
    assert len(old_layer.versions) == 2
    assert len(older_layer.versions) == 2
    assert len(other_layer.versions) == 2
    assert len(old_layer.geojson.storage.listdir(root)[1]) == 7
    call_command("purge_old_versions", "--days-ago=9")
    assert len(recent_layer.versions) == 1
    assert len(old_layer.versions) == 2
    assert len(older_layer.versions) == 2
    assert len(other_layer.versions) == 2
    assert len(old_layer.geojson.storage.listdir(root)[1]) == 7
    call_command("purge_old_versions", "--days-ago=7")
    assert len(recent_layer.versions) == 1
    assert len(old_layer.versions) == 1
    assert len(older_layer.versions) == 2
    assert len(other_layer.versions) == 2
    # Files including gz for map 1
    # recent layer geojson
    # old layer 1 geojson
    # older layer 2 geojson + 1 gz
    assert len(old_layer.geojson.storage.listdir(root)[1]) == 5
    call_command("purge_old_versions", "--days-ago=7", "--days-to-select=0")
    assert len(recent_layer.versions) == 1
    assert len(old_layer.versions) == 1
    assert len(older_layer.versions) == 1
    assert len(other_layer.versions) == 2
    # Files including gz for map 1
    # recent layer geojson
    # old layer 1 geojson
    # older layer 1 geojson
    assert len(old_layer.geojson.storage.listdir(root)[1]) == 3
