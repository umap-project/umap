import json
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path
from unittest import mock
from uuid import uuid4

import pytest
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from umap.models import DataLayer, Map

from .base import MapFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def post_data():
    return {
        "name": "name",
        "display_on_load": True,
        "settings": '{"displayOnLoad": true, "browsable": true, "name": "name"}',
        "rank": 0,
        "geojson": SimpleUploadedFile(
            "name.json",
            b'{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-3.1640625,53.014783245859235],[-3.1640625,51.86292391360244],[-0.50537109375,51.385495069223204],[1.16455078125,52.38901106223456],[-0.41748046875,53.91728101547621],[-2.109375,53.85252660044951],[-3.1640625,53.014783245859235]]]},"properties":{"_umap_options":{},"name":"Ho god, sounds like a polygouine"}},{"type":"Feature","geometry":{"type":"LineString","coordinates":[[1.8017578124999998,51.16556659836182],[-0.48339843749999994,49.710272582105695],[-3.1640625,50.0923932109388],[-5.60302734375,51.998410382390325]]},"properties":{"_umap_options":{},"name":"Light line"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[0.63720703125,51.15178610143037]},"properties":{"_umap_options":{},"name":"marker he"}}],"_umap_options":{"displayOnLoad":true,"name":"new name","id":1668,"remoteData":{},"color":"LightSeaGreen","description":"test"}}',
        ),
    }


def test_get_with_public_mode(client, settings, datalayer, map):
    map.share_status = Map.PUBLIC
    map.save()
    url = reverse("datalayer_view", args=(map.pk, datalayer.pk))
    response = client.get(url)
    assert response.status_code == 200
    assert response["X-Datalayer-Version"] is not None
    assert response["Cache-Control"] is not None
    assert "Content-Encoding" not in response
    j = json.loads(response.content.decode())
    assert "_umap_options" in j
    assert "features" in j
    assert j["type"] == "FeatureCollection"


def test_get_with_x_accel_redirect(client, settings, datalayer, map):
    settings.UMAP_XSENDFILE_HEADER = "X-Accel-Redirect"
    url = reverse("datalayer_view", args=(map.pk, datalayer.pk))
    response = client.get(url)
    assert response.status_code == 200
    assert "X-Accel-Redirect" in response.headers
    assert response["X-Accel-Redirect"].startswith("/internal/datalayer/")
    assert response["X-Accel-Redirect"].endswith(".geojson")


def test_get_with_open_mode(client, settings, datalayer, map):
    map.share_status = Map.PUBLIC
    map.save()
    url = reverse("datalayer_view", args=(map.pk, datalayer.pk))
    response = client.get(url)
    assert response.status_code == 200


def test_get_with_blocked_mode(client, settings, datalayer, map):
    map.share_status = Map.BLOCKED
    map.save()
    url = reverse("datalayer_view", args=(map.pk, datalayer.pk))
    response = client.get(url)
    assert response.status_code == 403


def test_cannot_get_datalayer_if_not_public(client, settings, datalayer, map):
    map.share_status = Map.PRIVATE
    map.save()
    url = reverse("datalayer_view", args=(map.pk, datalayer.pk))
    response = client.get(url)
    assert response.status_code == 403


def test_cannot_get_datalayer_if_private_and_owner(client, settings, datalayer, map):
    map.share_status = Map.PRIVATE
    map.save()
    client.login(username=map.owner.username, password="123123")
    url = reverse(
        "datalayer_view",
        args=(
            map.pk,
            datalayer.pk,
        ),
    )
    response = client.get(url)
    assert response.status_code == 200


def test_gzip_should_be_created_if_accepted(client, datalayer, map, post_data):
    map.share_status = Map.PUBLIC
    map.save()
    url = reverse("datalayer_view", args=(map.pk, datalayer.pk))
    response = client.get(url, headers={"ACCEPT_ENCODING": "gzip"})
    assert response.status_code == 200
    flat = datalayer.geojson.path
    gzipped = datalayer.geojson.path + ".gz"
    assert Path(flat).exists()
    assert Path(gzipped).exists()
    assert Path(flat).stat().st_mtime_ns == Path(gzipped).stat().st_mtime_ns


def test_create_datalayer(client, map, post_data):
    uuid = str(uuid4())
    url = reverse("datalayer_create", args=(map.pk, uuid))
    client.login(username=map.owner.username, password="123123")
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 200
    new_datalayer = DataLayer.objects.get(pk=uuid)
    assert new_datalayer.name == "name"
    assert new_datalayer.rank == 0
    # Test response is a json
    data = json.loads(response.content.decode())
    assert "id" in data
    assert data["id"] == uuid


def test_update(client, datalayer, map, post_data):
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")
    name = "new name"
    rank = 2
    post_data["name"] = name
    post_data["rank"] = rank
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 200
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name == name
    assert modified_datalayer.rank == rank
    # Test response is a json
    j = json.loads(response.content.decode())
    assert "id" in j
    assert str(datalayer.pk) == j["id"]
    assert j["browsable"] is True
    assert Path(modified_datalayer.geojson.path).exists()


def test_should_not_be_possible_to_update_with_wrong_map_id_in_url(
    client, datalayer, map, post_data
):
    other_map = MapFactory(owner=map.owner)
    url = reverse("datalayer_update", args=(other_map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")
    name = "new name"
    post_data["name"] = name
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 403
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name == datalayer.name


def test_delete(client, datalayer, map):
    assert map.datalayers.count() == 1
    url = reverse("datalayer_delete", args=(map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")
    response = client.post(url, {}, follow=True)
    assert response.status_code == 200
    assert DataLayer.objects.filter(pk=datalayer.pk).count()
    assert map.datalayers.count() == 0
    assert DataLayer.objects.get(pk=datalayer.pk).share_status == DataLayer.DELETED
    # Check that map has not been impacted
    assert Map.objects.filter(pk=map.pk).exists()
    # Test response is a json
    j = json.loads(response.content.decode())
    assert "info" in j


def test_should_not_be_possible_to_delete_with_wrong_map_id_in_url(
    client, datalayer, map
):
    other_map = MapFactory(owner=map.owner)
    url = reverse("datalayer_delete", args=(other_map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")
    response = client.post(url, {}, follow=True)
    assert response.status_code == 403
    assert DataLayer.objects.filter(pk=datalayer.pk).exists()


def test_optimistic_concurrency_control_with_good_version(
    client, datalayer, map, post_data
):
    map.share_status = Map.PUBLIC
    map.save()
    # Get reference version
    url = reverse("datalayer_view", args=(map.pk, datalayer.pk))
    response = client.get(url)
    reference_version = response["X-Datalayer-Version"]
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")
    name = "new name"
    post_data["name"] = "new name"
    response = client.post(
        url, post_data, follow=True, HTTP_X_DATALAYER_REFERENCE=reference_version
    )
    assert response.status_code == 200
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name == name


def test_optimistic_concurrency_control_with_bad_version(
    client, datalayer, map, post_data
):
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")
    name = "new name"
    post_data["name"] = name
    response = client.post(
        url, post_data, follow=True, HTTP_X_DATALAYER_REFERENCE="xxx"
    )
    assert response.status_code == 412
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name != name


def test_optimistic_concurrency_control_with_empty_version(
    client, datalayer, map, post_data
):
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")
    name = "new name"
    post_data["name"] = name
    response = client.post(url, post_data, follow=True, X_DATALAYER_REFERENCE=None)
    assert response.status_code == 200
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name == name


def test_versions_should_return_versions(client, datalayer, map, settings):
    map.share_status = Map.PUBLIC
    map.save()
    root = datalayer.geojson.storage._base_path(datalayer)
    datalayer.geojson.storage.save(
        "%s/%s_1440924889.geojson" % (root, datalayer.pk), ContentFile("{}")
    )
    datalayer.geojson.storage.save(
        "%s/%s_1440923687.geojson" % (root, datalayer.pk), ContentFile("{}")
    )
    datalayer.geojson.storage.save(
        "%s/%s_1440918637.geojson" % (root, datalayer.pk), ContentFile("{}")
    )
    url = reverse("datalayer_versions", args=(map.pk, datalayer.pk))
    versions = json.loads(client.get(url).content.decode())
    assert len(versions["versions"]) == 4
    version = {
        "name": "%s_1440918637.geojson" % datalayer.pk,
        "size": 2,
        "at": "1440918637",
        "ref": "1440918637",
    }
    assert version in versions["versions"]


def test_versions_can_return_old_format(client, datalayer, map, settings):
    map.share_status = Map.PUBLIC
    map.save()
    root = datalayer.geojson.storage._base_path(datalayer)
    datalayer.old_id = 123  # old datalayer id (now replaced by uuid)
    datalayer.save()

    datalayer.geojson.storage.save(
        "%s/%s_1440924889.geojson" % (root, datalayer.pk), ContentFile("{}")
    )
    datalayer.geojson.storage.save(
        "%s/%s_1440923687.geojson" % (root, datalayer.pk), ContentFile("{}")
    )

    # store with the id prefix (rather than the uuid)
    old_format_version = "%s_1440918637.geojson" % datalayer.old_id
    datalayer.geojson.storage.save(
        ("%s/" % root) + old_format_version, ContentFile("{}")
    )

    url = reverse("datalayer_versions", args=(map.pk, datalayer.pk))
    versions = json.loads(client.get(url).content.decode())
    assert len(versions["versions"]) == 4
    version = {
        "name": old_format_version,
        "size": 2,
        "at": "1440918637",
        "ref": "1440918637",
    }
    assert version in versions["versions"]

    client.get(reverse("datalayer_version", args=(map.pk, datalayer.pk, "1440918637")))


def test_version_should_return_one_version_geojson(client, datalayer, map):
    map.share_status = Map.PUBLIC
    map.save()
    root = datalayer.geojson.storage._base_path(datalayer)
    name = "%s_1440924889.geojson" % datalayer.pk
    datalayer.geojson.storage.save("%s/%s" % (root, name), ContentFile("{}"))
    url = reverse("datalayer_version", args=(map.pk, datalayer.pk, "1440924889"))
    resp = client.get(url)
    assert resp.status_code == 200
    assert resp.content.decode() == "{}"


def test_version_should_return_403_if_not_allowed(client, datalayer, map):
    map.share_status = Map.PRIVATE
    map.save()
    root = datalayer.geojson.storage._base_path(datalayer)
    name = "%s_1440924889.geojson" % datalayer.pk
    datalayer.geojson.storage.save("%s/%s" % (root, name), ContentFile("{}"))
    url = reverse("datalayer_version", args=(map.pk, datalayer.pk, "1440924889"))
    assert client.get(url).status_code == 403


def test_update_readonly(client, datalayer, map, post_data, settings):
    settings.UMAP_READONLY = True
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 403


@pytest.mark.usefixtures("allow_anonymous")
def test_anonymous_owner_can_edit_in_anonymous_owner_mode(
    datalayer, cookieclient, anonymap, post_data
):
    datalayer.edit_status = DataLayer.OWNER
    datalayer.save()
    url = reverse("datalayer_update", args=(anonymap.pk, datalayer.pk))
    name = "new name"
    post_data["name"] = name
    response = cookieclient.post(url, post_data, follow=True)
    assert response.status_code == 200
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name == name


@pytest.mark.usefixtures("allow_anonymous")
def test_anonymous_can_edit_in_anonymous_owner_but_public_mode(
    datalayer, client, anonymap, post_data
):
    datalayer.edit_status = DataLayer.ANONYMOUS
    datalayer.save()
    url = reverse("datalayer_update", args=(anonymap.pk, datalayer.pk))
    name = "new name"
    post_data["name"] = name
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 200
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name == name


@pytest.mark.usefixtures("allow_anonymous")
def test_anonymous_cannot_edit_in_anonymous_owner_mode(
    datalayer, client, anonymap, post_data
):
    datalayer.edit_status = DataLayer.OWNER
    datalayer.save()
    url = reverse("datalayer_update", args=(anonymap.pk, datalayer.pk))
    name = "new name"
    post_data["name"] = name
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 403


def test_anonymous_cannot_edit_in_owner_mode(datalayer, client, map, post_data):
    datalayer.edit_status = DataLayer.OWNER
    datalayer.save()
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    name = "new name"
    post_data["name"] = name
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 403


def test_anonymous_can_edit_in_owner_but_public_mode(datalayer, client, map, post_data):
    datalayer.edit_status = DataLayer.ANONYMOUS
    datalayer.save()
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    name = "new name"
    post_data["name"] = name
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 200
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name == name


def test_owner_can_edit_in_owner_mode(datalayer, client, map, post_data):
    client.login(username=map.owner.username, password="123123")
    datalayer.edit_status = DataLayer.OWNER
    datalayer.save()
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    name = "new name"
    post_data["name"] = name
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 200
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name == name


def test_editor_can_edit_in_editors_mode(datalayer, client, map, post_data):
    client.login(username=map.owner.username, password="123123")
    datalayer.edit_status = DataLayer.COLLABORATORS
    datalayer.save()
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    name = "new name"
    post_data["name"] = name
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 200
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name == name


@pytest.mark.usefixtures("allow_anonymous")
def test_anonymous_owner_can_edit_if_inherit_and_map_in_owner_mode(
    datalayer, cookieclient, anonymap, post_data
):
    anonymap.edit_status = Map.OWNER
    anonymap.save()
    datalayer.edit_status = DataLayer.INHERIT
    datalayer.save()
    url = reverse("datalayer_update", args=(anonymap.pk, datalayer.pk))
    name = "new name"
    post_data["name"] = name
    response = cookieclient.post(url, post_data, follow=True)
    assert response.status_code == 200
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name == name


@pytest.mark.usefixtures("allow_anonymous")
def test_anonymous_user_cannot_edit_if_inherit_and_map_in_owner_mode(
    datalayer, client, anonymap, post_data
):
    anonymap.edit_status = Map.OWNER
    anonymap.save()
    datalayer.edit_status = DataLayer.INHERIT
    datalayer.save()
    url = reverse("datalayer_update", args=(anonymap.pk, datalayer.pk))
    name = "new name"
    post_data["name"] = name
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 403


@pytest.mark.usefixtures("allow_anonymous")
def test_anonymous_user_can_edit_if_inherit_and_map_in_public_mode(
    datalayer, client, anonymap, post_data
):
    anonymap.edit_status = Map.ANONYMOUS
    anonymap.save()
    datalayer.edit_status = DataLayer.INHERIT
    datalayer.save()
    url = reverse("datalayer_update", args=(anonymap.pk, datalayer.pk))
    name = "new name"
    post_data["name"] = name
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 200
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name == name


@pytest.fixture
def reference_data():
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [-1, 2]},
                "properties": {"_umap_options": {}, "name": "foo"},
            },
            {
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": [2, 3]},
                "properties": {"_umap_options": {}, "name": "bar"},
            },
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [3, 4]},
                "properties": {"_umap_options": {}, "name": "marker"},
            },
        ],
        "_umap_options": {
            "displayOnLoad": True,
            "name": "new name",
            "id": 1668,
            "remoteData": {},
            "color": "LightSeaGreen",
            "description": "test",
        },
    }


def test_optimistic_merge_both_added(client, datalayer, map, reference_data):
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")

    # Reference data is:
    # Point (-1, 2); Linestring (2, 3); Point (3, 4).

    post_data = {
        "name": "name",
        "display_on_load": True,
        "rank": 0,
        "geojson": SimpleUploadedFile(
            "foo.json", json.dumps(reference_data).encode("utf-8")
        ),
    }
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 200

    response = client.get(reverse("datalayer_view", args=(map.pk, datalayer.pk)))
    reference_version = response.headers.get("X-Datalayer-Version")

    # Client 1 adds "Point 5, 6" to the existing data
    client1_feature = {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [5, 6]},
        "properties": {"_umap_options": {}, "name": "marker"},
    }
    client1_data = deepcopy(reference_data)
    client1_data["features"].append(client1_feature)

    post_data["geojson"] = SimpleUploadedFile(
        "foo.json",
        json.dumps(client1_data).encode("utf-8"),
    )
    response = client.post(
        url,
        post_data,
        follow=True,
        headers={"X-Datalayer-Reference": reference_version},
    )
    assert response.status_code == 200

    # Client 2 adds "Point 7, 8" instead, on the same reference.
    client2_feature = {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [7, 8]},
        "properties": {"_umap_options": {}, "name": "marker"},
    }
    client2_data = deepcopy(reference_data)
    client2_data["features"].append(client2_feature)

    post_data["geojson"] = SimpleUploadedFile(
        "foo.json",
        json.dumps(client2_data).encode("utf-8"),
    )
    response = client.post(
        url,
        post_data,
        follow=True,
        headers={"X-Datalayer-Reference": reference_version},
    )
    assert response.status_code == 200
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    merged_features = json.load(modified_datalayer.geojson)["features"]

    for reference_feature in reference_data["features"]:
        assert reference_feature in merged_features

    assert client1_feature in merged_features
    assert client2_feature in merged_features


def test_optimistic_merge_conflicting_change_raises(
    client, datalayer, map, reference_data
):
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")

    # Reference data is:
    # Point (-1, 2); Linestring (2, 3); Point (3, 4).

    post_data = {
        "name": "name",
        "display_on_load": True,
        "rank": 0,
        "geojson": SimpleUploadedFile(
            "foo.json", json.dumps(reference_data).encode("utf-8")
        ),
    }
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 200

    response = client.get(reverse("datalayer_view", args=(map.pk, datalayer.pk)))

    reference_version = response.headers.get("X-Datalayer-Version")

    # First client changes the first feature.
    client1_data = deepcopy(reference_data)
    client1_data["features"][0]["geometry"] = {"type": "Point", "coordinates": [5, 6]}

    post_data["geojson"] = SimpleUploadedFile(
        "foo.json",
        json.dumps(client1_data).encode("utf-8"),
    )
    response = client.post(
        url,
        post_data,
        follow=True,
        headers={"X-Datalayer-Reference": reference_version},
    )
    assert response.status_code == 200

    # Second client changes the first feature as well.
    client2_data = deepcopy(reference_data)
    client2_data["features"][0]["geometry"] = {"type": "Point", "coordinates": [7, 8]}

    post_data["geojson"] = SimpleUploadedFile(
        "foo.json",
        json.dumps(client2_data).encode("utf-8"),
    )
    response = client.post(
        url,
        post_data,
        follow=True,
        headers={"X-Datalayer-Reference": reference_version},
    )
    assert response.status_code == 412

    # Check that the server rejected conflicting changes.
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    merged_features = json.load(modified_datalayer.geojson)["features"]
    assert merged_features == client1_data["features"]


def test_saving_datalayer_should_change_map_last_modified(
    client, datalayer, map, post_data
):
    with mock.patch("django.utils.timezone.now") as mocked:
        mocked.return_value = datetime.utcnow() - timedelta(days=8)
        map.save()  # Change last_modified to past
    old_modified_at = map.modified_at.date()
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")
    response = client.post(url, post_data, follow=True)
    assert response.status_code == 200
    assert Map.objects.get(pk=map.pk).modified_at.date() != old_modified_at
