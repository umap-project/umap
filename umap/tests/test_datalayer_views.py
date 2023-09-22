import json
from pathlib import Path

import pytest
from django.core.files.base import ContentFile
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
        "geojson": '{"type":"FeatureCollection","features":[{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-3.1640625,53.014783245859235],[-3.1640625,51.86292391360244],[-0.50537109375,51.385495069223204],[1.16455078125,52.38901106223456],[-0.41748046875,53.91728101547621],[-2.109375,53.85252660044951],[-3.1640625,53.014783245859235]]]},"properties":{"_umap_options":{},"name":"Ho god, sounds like a polygouine"}},{"type":"Feature","geometry":{"type":"LineString","coordinates":[[1.8017578124999998,51.16556659836182],[-0.48339843749999994,49.710272582105695],[-3.1640625,50.0923932109388],[-5.60302734375,51.998410382390325]]},"properties":{"_umap_options":{},"name":"Light line"}},{"type":"Feature","geometry":{"type":"Point","coordinates":[0.63720703125,51.15178610143037]},"properties":{"_umap_options":{},"name":"marker he"}}],"_umap_options":{"displayOnLoad":true,"name":"new name","id":1668,"remoteData":{},"color":"LightSeaGreen","description":"test"}}',
    }


def test_get_with_public_mode(client, settings, datalayer, map):
    map.share_status = Map.PUBLIC
    map.save()
    url = reverse("datalayer_view", args=(map.pk, datalayer.pk))
    response = client.get(url)
    assert response.status_code == 200
    assert response["Last-Modified"] is not None
    assert response["Cache-Control"] is not None
    assert "Content-Encoding" not in response
    j = json.loads(response.content.decode())
    assert "_umap_options" in j
    assert "features" in j
    assert j["type"] == "FeatureCollection"


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
    assert datalayer.pk == j["id"]
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
    url = reverse("datalayer_delete", args=(map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")
    response = client.post(url, {}, follow=True)
    assert response.status_code == 200
    assert not DataLayer.objects.filter(pk=datalayer.pk).count()
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


def test_optimistic_concurrency_control_with_good_last_modified(
    client, datalayer, map, post_data
):
    map.share_status = Map.PUBLIC
    map.save()
    # Get Last-Modified
    url = reverse("datalayer_view", args=(map.pk, datalayer.pk))
    response = client.get(url)
    last_modified = response["Last-Modified"]
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")
    name = "new name"
    post_data["name"] = "new name"
    response = client.post(
        url, post_data, follow=True, HTTP_IF_UNMODIFIED_SINCE=last_modified
    )
    assert response.status_code == 200
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name == name


def test_optimistic_concurrency_control_with_bad_last_modified(
    client, datalayer, map, post_data
):
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")
    name = "new name"
    post_data["name"] = name
    response = client.post(url, post_data, follow=True, HTTP_IF_UNMODIFIED_SINCE="xxx")
    assert response.status_code == 412
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name != name


def test_optimistic_concurrency_control_with_empty_last_modified(
    client, datalayer, map, post_data
):
    url = reverse("datalayer_update", args=(map.pk, datalayer.pk))
    client.login(username=map.owner.username, password="123123")
    name = "new name"
    post_data["name"] = name
    response = client.post(url, post_data, follow=True, HTTP_IF_UNMODIFIED_SINCE=None)
    assert response.status_code == 200
    modified_datalayer = DataLayer.objects.get(pk=datalayer.pk)
    assert modified_datalayer.name == name


def test_versions_should_return_versions(client, datalayer, map, settings):
    map.share_status = Map.PUBLIC
    map.save()
    root = datalayer.storage_root()
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
    }
    assert version in versions["versions"]


def test_version_should_return_one_version_geojson(client, datalayer, map):
    map.share_status = Map.PUBLIC
    map.save()
    root = datalayer.storage_root()
    name = "%s_1440924889.geojson" % datalayer.pk
    datalayer.geojson.storage.save("%s/%s" % (root, name), ContentFile("{}"))
    url = reverse("datalayer_version", args=(map.pk, datalayer.pk, name))
    assert client.get(url).content.decode() == "{}"


def test_version_should_return_403_if_not_allowed(client, datalayer, map):
    map.share_status = Map.PRIVATE
    map.save()
    root = datalayer.storage_root()
    name = "%s_1440924889.geojson" % datalayer.pk
    datalayer.geojson.storage.save("%s/%s" % (root, name), ContentFile("{}"))
    url = reverse("datalayer_version", args=(map.pk, datalayer.pk, name))
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
    datalayer.edit_status = DataLayer.EDITORS
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
