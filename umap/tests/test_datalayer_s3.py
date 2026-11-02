import json
import os
from datetime import UTC, datetime

import boto3
import pytest
from botocore.errorfactory import ClientError
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from moto import mock_aws

from umap.models import DataLayer

from .base import DataLayerFactory

pytestmark = pytest.mark.django_db


def test_archive_preserves_s3_versions_and_recovers_after_partial_storage_write(
    map, monkeypatch
):
    from umap import feature_archiving
    from umap.feature_timing import cleanup_layer
    from umap.models import FeatureArchive

    from .test_feature_archiving import pair
    from .test_feature_timing import read

    source, target, data = pair(map)
    source_ref, target_ref = source.reference_version, target.reference_version
    write = feature_archiving.write_layer

    def interrupt_after_removal(layer, *args, **kwargs):
        result = write(layer, *args, **kwargs)
        if layer.pk == source.pk:
            raise OSError("Synthetic interruption after S3 object PUT")
        return result

    monkeypatch.setattr(feature_archiving, "write_layer", interrupt_after_removal)
    with pytest.raises(OSError):
        cleanup_layer(source.pk, datetime(2030, 1, 2, tzinfo=UTC))
    # S3 objects have changed even though the pointer transaction rolled back.
    assert not read(source)["features"]
    assert len(read(target)["features"]) == 1
    assert FeatureArchive.objects.filter(completed=False).exists()
    monkeypatch.setattr(feature_archiving, "write_layer", write)
    assert cleanup_layer(source.pk, datetime(2030, 1, 2, tzinfo=UTC)) == 1
    assert len(read(target)["features"]) == 1
    assert FeatureArchive.objects.get(source=source).completed
    assert json.loads(source.get_version(source_ref))["features"] == data["features"]
    assert not json.loads(target.get_version(target_ref))["features"]


def test_timed_cleanup_preserves_s3_history(map):
    from umap.feature_timing import cleanup_layer

    from .test_feature_timing import document, read

    data = document()
    layer = DataLayerFactory(map=map, data=data)
    reference = layer.reference_version
    assert cleanup_layer(layer.pk, datetime(2030, 1, 2, tzinfo=UTC)) == 1
    assert not read(layer)["features"]
    assert json.loads(layer.get_version(reference))["features"] == data["features"]
    assert layer.expiredfeature_set.count() == 1


@pytest.fixture(scope="module", autouse=True)
def patch_storage():
    """Mocked AWS Credentials for moto."""
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
    before = DataLayer.geojson.field.storage

    DataLayer.geojson.field.storage = storages.create_storage(
        {
            "BACKEND": "umap.storage.s3.S3DataStorage",
            "OPTIONS": {
                "access_key": "testing",
                "secret_key": "testing",
                "bucket_name": "umap",
                "region_name": "us-east-1",
            },
        }
    )
    yield
    DataLayer.geojson.field.storage = before


@pytest.fixture(scope="module", autouse=True)
def mocked_aws():
    """
    Mock all AWS interactions
    Requires you to create your own boto3 clients
    """
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket="umap")
        client.put_bucket_versioning(
            Bucket="umap", VersioningConfiguration={"Status": "Enabled"}
        )
        yield


def test_can_create_datalayer(map, datalayer):
    other = DataLayerFactory(map=map)
    assert datalayer.geojson.name == f"{datalayer.pk}.geojson"
    assert other.geojson.name == f"{other.pk}.geojson"


def test_clone_should_return_new_instance(map, datalayer):
    clone = datalayer.clone()
    assert datalayer.pk != clone.pk
    assert datalayer.name == clone.name
    assert datalayer.map == clone.map
    assert datalayer.geojson != clone.geojson
    assert datalayer.geojson.name != clone.geojson.name
    assert clone.geojson.name == f"{clone.pk}.geojson"


def test_update_should_add_version(map, datalayer):
    assert len(datalayer.versions) == 1
    datalayer.geojson = ContentFile("{}", "foo.json")
    datalayer.save()
    assert len(datalayer.versions) == 2


def test_get_version(map, datalayer):
    assert len(datalayer.versions) == 1
    datalayer.geojson = ContentFile(b'{"foo": "bar"}', "foo.json")
    datalayer.save()
    assert len(datalayer.versions) == 2
    latest = datalayer.versions[0]["ref"]
    version = datalayer.get_version(latest)
    assert json.loads(version) == {"foo": "bar"}
    older = datalayer.versions[1]["ref"]
    version = datalayer.get_version(older)
    assert json.loads(version) == {
        "properties": {
            "browsable": True,
            "displayOnLoad": True,
            "name": "test datalayer",
        },
        "features": [
            {
                "geometry": {
                    "coordinates": [
                        14.68896484375,
                        48.55297816440071,
                    ],
                    "type": "Point",
                },
                "id": "ExNTQ",
                "properties": {
                    "_umap_options": {
                        "color": "DarkCyan",
                        "iconClass": "Ball",
                    },
                    "description": "Da place anonymous again 755",
                    "name": "Here",
                },
                "type": "Feature",
            },
        ],
        "type": "FeatureCollection",
    }

    latest = datalayer.reference_version
    version = datalayer.get_version(latest)
    assert json.loads(version) == {"foo": "bar"}


def test_delete_datalayer_should_delete_all_versions(datalayer):
    # create a new version
    datalayer.geojson = ContentFile('{"foo": "bar"}', "foo.json")
    datalayer.save()
    s3_key = datalayer.geojson.name
    datalayer.delete()
    with pytest.raises(ClientError):
        datalayer.geojson.storage.connection.meta.client.get_object(
            Bucket="umap",
            Key=s3_key,
        )
