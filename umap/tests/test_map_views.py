import json
import zipfile
from io import BytesIO

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.signing import Signer
from django.urls import reverse
from django.utils import translation

from umap.models import DataLayer, Map, Star

from .base import MapFactory, UserFactory, login_required

pytestmark = pytest.mark.django_db
User = get_user_model()


@pytest.fixture
def post_data():
    return {
        "name": "name",
        "center": '{"type":"Point","coordinates":[13.447265624999998,48.94415123418794]}',  # noqa
        "settings": '{"type":"Feature","geometry":{"type":"Point","coordinates":[5.0592041015625,52.05924589011585]},"properties":{"tilelayer":{"maxZoom":20,"url_template":"http://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png","minZoom":0,"attribution":"HOT and friends"},"licence":"","description":"","name":"test enrhûmé","tilelayersControl":true,"displayDataBrowserOnLoad":false,"displayPopupFooter":true,"displayCaptionOnLoad":false,"miniMap":true,"moreControl":true,"scaleControl":true,"zoomControl":true,"datalayersControl":true,"zoom":8}}',  # noqa
    }


def test_create(client, user, post_data):
    url = reverse("map_create")
    # POST only mendatory fields
    name = "test-map-with-new-name"
    post_data["name"] = name
    client.login(username=user.username, password="123123")
    response = client.post(url, post_data)
    assert response.status_code == 200
    j = json.loads(response.content.decode())
    created_map = Map.objects.latest("pk")
    assert j["id"] == created_map.pk
    assert created_map.name == name
    assert created_map.center.x == 13.447265624999998
    assert created_map.center.y == 48.94415123418794
    assert j["permissions"] == {
        "edit_status": 3,
        "share_status": 0,
        "owner": {"id": user.pk, "name": "Joe", "url": "/en/user/Joe/"},
        "editors": [],
    }


def test_map_create_permissions(client, settings):
    settings.UMAP_ALLOW_ANONYMOUS = False
    url = reverse("map_create")
    # POST anonymous
    response = client.post(url, {})
    assert login_required(response)


def test_map_update_access(client, map, user):
    url = reverse("map_update", kwargs={"map_id": map.pk})
    # GET anonymous
    response = client.get(url)
    assert login_required(response)
    # POST anonymous
    response = client.post(url, {})
    assert login_required(response)
    # GET with wrong permissions
    client.login(username=user.username, password="123123")
    response = client.get(url)
    assert response.status_code == 403
    # POST with wrong permissions
    client.login(username=user.username, password="123123")
    response = client.post(url, {})
    assert response.status_code == 403


def test_map_update_permissions_access(client, map, user):
    url = reverse("map_update_permissions", kwargs={"map_id": map.pk})
    # GET anonymous
    response = client.get(url)
    assert login_required(response)
    # POST anonymous
    response = client.post(url, {})
    assert login_required(response)
    # GET with wrong permissions
    client.login(username=user.username, password="123123")
    response = client.get(url)
    assert response.status_code == 403
    # POST with wrong permissions
    client.login(username=user.username, password="123123")
    response = client.post(url, {})
    assert response.status_code == 403


def test_update(client, map, post_data):
    url = reverse("map_update", kwargs={"map_id": map.pk})
    # POST only mendatory fields
    name = "new map name"
    post_data["name"] = name
    client.login(username=map.owner.username, password="123123")
    response = client.post(url, post_data)
    assert response.status_code == 200
    j = json.loads(response.content.decode())
    assert "html" not in j
    updated_map = Map.objects.get(pk=map.pk)
    assert j["id"] == updated_map.pk
    assert updated_map.name == name


def test_delete(client, map, datalayer):
    url = reverse("map_delete", args=(map.pk,))
    client.login(username=map.owner.username, password="123123")
    response = client.post(
        url, headers={"X-Requested-With": "XMLHttpRequest"}, follow=True
    )
    assert response.status_code == 200
    assert Map.objects.filter(pk=map.pk).exists()
    assert DataLayer.objects.filter(pk=datalayer.pk).exists()
    reloaded = Map.objects.get(pk=map.pk)
    assert reloaded.share_status == Map.DELETED
    # Check that user has not been impacted
    assert User.objects.filter(pk=map.owner.pk).exists()
    # Test response is a json
    j = json.loads(response.content.decode())
    assert "redirect" in j


def test_wrong_slug_should_redirect_to_canonical(client, map):
    url = reverse("map", kwargs={"map_id": map.pk, "slug": "wrong-slug"})
    canonical = reverse("map", kwargs={"map_id": map.pk, "slug": map.slug})
    response = client.get(url)
    assert response.status_code == 301
    assert response["Location"] == canonical


def test_wrong_slug_should_redirect_with_query_string(client, map):
    url = reverse("map", kwargs={"map_id": map.pk, "slug": "wrong-slug"})
    url = "{}?editMode=simple".format(url)
    canonical = reverse("map", kwargs={"map_id": map.pk, "slug": map.slug})
    canonical = "{}?editMode=simple".format(canonical)
    response = client.get(url)
    assert response.status_code == 301
    assert response["Location"] == canonical


def test_should_not_consider_the_query_string_for_canonical_check(client, map):
    url = reverse("map", kwargs={"map_id": map.pk, "slug": map.slug})
    url = "{}?editMode=simple".format(url)
    response = client.get(url)
    assert response.status_code == 200


def test_map_headers(client, map):
    url = reverse("map", kwargs={"map_id": map.pk, "slug": map.slug})
    response = client.get(url)
    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == "*"


def test_short_url_should_redirect_to_canonical(client, map):
    url = reverse("map_short_url", kwargs={"pk": map.pk})
    canonical = reverse("map", kwargs={"map_id": map.pk, "slug": map.slug})
    response = client.get(url)
    assert response.status_code == 301
    assert response["Location"] == canonical


def test_clone_map_should_create_a_new_instance(client, map):
    assert Map.objects.count() == 1
    url = reverse("map_clone", kwargs={"map_id": map.pk})
    client.login(username=map.owner.username, password="123123")
    response = client.post(url)
    assert response.status_code == 302
    assert Map.objects.count() == 2
    clone = Map.objects.latest("pk")
    assert response["Location"] == clone.get_absolute_url()
    assert clone.pk != map.pk
    assert clone.name == "Clone of " + map.name


def test_clone_map_should_be_possible_via_ajax(client, map):
    assert Map.objects.count() == 1
    url = reverse("map_clone", kwargs={"map_id": map.pk})
    client.login(username=map.owner.username, password="123123")
    response = client.post(url, headers={"X-Requested-With": "XMLHttpRequest"})
    assert response.status_code == 200
    assert Map.objects.count() == 2
    clone = Map.objects.latest("pk")
    assert response.json() == {"redirect": clone.get_absolute_url()}
    assert clone.pk != map.pk
    assert clone.name == "Clone of " + map.name


def test_user_not_allowed_should_not_clone_map(client, map, user, settings):
    settings.UMAP_ALLOW_ANONYMOUS = False
    assert Map.objects.count() == 1
    url = reverse("map_clone", kwargs={"map_id": map.pk})
    map.edit_status = map.OWNER
    map.save()
    response = client.post(url)
    assert login_required(response)
    client.login(username=user.username, password="123123")
    response = client.post(url)
    assert response.status_code == 403
    map.edit_status = map.ANONYMOUS
    map.save()
    client.logout()
    response = client.post(url)
    assert response.status_code == 403
    assert Map.objects.count() == 1


def test_clone_should_set_cloner_as_owner(client, map, user):
    url = reverse("map_clone", kwargs={"map_id": map.pk})
    map.edit_status = map.COLLABORATORS
    map.editors.add(user)
    map.save()
    client.login(username=user.username, password="123123")
    response = client.post(url)
    assert response.status_code == 302
    assert Map.objects.count() == 2
    clone = Map.objects.latest("pk")
    assert clone.pk != map.pk
    assert clone.name == "Clone of " + map.name
    assert clone.owner == user


def test_map_creation_should_allow_unicode_names(client, map, post_data):
    url = reverse("map_create")
    # POST only mendatory fields
    name = "Академический"
    post_data["name"] = name
    client.login(username=map.owner.username, password="123123")
    response = client.post(url, post_data)
    assert response.status_code == 200
    j = json.loads(response.content.decode())
    created_map = Map.objects.latest("pk")
    assert j["id"] == created_map.pk
    assert created_map.name == name
    # Lower case of the russian original name
    # self.assertEqual(created_map.slug, u"академический")
    # for now we fallback to "map", see unicode_name branch
    assert created_map.slug == "map"


@pytest.mark.parametrize("share_status", [Map.PUBLIC, Map.OPEN])
def test_anonymous_can_access_map_with_share_status_accessible(
    client, map, share_status
):
    url = reverse("map", args=(map.slug, map.pk))
    map.share_status = share_status
    map.save()
    response = client.get(url)
    assert response.status_code == 200


@pytest.mark.parametrize(
    "share_status", [Map.PRIVATE, Map.DRAFT, Map.BLOCKED, Map.DELETED]
)
def test_anonymous_cannot_access_map_with_share_status_restricted(
    client, map, share_status
):
    url = reverse("map", args=(map.slug, map.pk))
    map.share_status = share_status
    map.save()
    response = client.get(url)
    assert response.status_code == 403


@pytest.mark.parametrize("share_status", [Map.PRIVATE, Map.DRAFT])
def test_owner_can_access_map_with_share_status_restricted(client, map, share_status):
    url = reverse("map", args=(map.slug, map.pk))
    map.share_status = share_status
    map.save()
    client.login(username=map.owner.username, password="123123")
    response = client.get(url)
    assert response.status_code == 200


@pytest.mark.parametrize("share_status", [Map.PRIVATE, Map.DRAFT])
def test_editors_can_access_map_with_share_status_resricted(
    client, map, user, share_status
):
    url = reverse("map", args=(map.slug, map.pk))
    map.share_status = share_status
    map.editors.add(user)
    map.save()
    client.login(username=user.username, password="123123")
    response = client.get(url)
    assert response.status_code == 200


def test_owner_cannot_access_map_with_share_status_deleted(client, map):
    url = reverse("map", args=(map.slug, map.pk))
    map.share_status = map.DELETED
    map.save()
    client.login(username=map.owner.username, password="123123")
    response = client.get(url)
    assert response.status_code == 403


def test_owner_cannot_access_map_with_share_status_blocked(client, map):
    url = reverse("map", args=(map.slug, map.pk))
    map.share_status = map.BLOCKED
    map.save()
    client.login(username=map.owner.username, password="123123")
    response = client.get(url)
    assert response.status_code == 403


def test_non_editor_cannot_access_map_if_share_status_private(client, map, user):
    url = reverse("map", args=(map.slug, map.pk))
    map.share_status = map.PRIVATE
    map.save()
    client.login(username=user.username, password="123123")
    response = client.get(url)
    assert response.status_code == 403


def test_map_geojson_view(client, map):
    url = reverse("map_geojson", args=(map.pk,))
    response = client.get(url)
    j = json.loads(response.content.decode())
    assert "json" in response["content-type"]
    assert "type" in j


def test_only_owner_can_delete(client, map, user):
    map.editors.add(user)
    url = reverse("map_delete", kwargs={"map_id": map.pk})
    client.login(username=user.username, password="123123")
    response = client.post(
        url, headers={"X-Requested-With": "XMLHttpRequest"}, follow=True
    )
    assert response.status_code == 403


def test_map_editors_do_not_see_owner_change_input(client, map, user):
    map.editors.add(user)
    map.edit_status = map.COLLABORATORS
    map.save()
    url = reverse("map_update_permissions", kwargs={"map_id": map.pk})
    client.login(username=user.username, password="123123")
    response = client.get(url)
    assert "id_owner" not in response


def test_logged_in_user_can_edit_map_editable_by_anonymous(client, map, user):
    map.owner = None
    map.edit_status = map.ANONYMOUS
    map.save()
    client.login(username=user.username, password="123123")
    url = reverse("map_update", kwargs={"map_id": map.pk})
    new_name = "this is my new name"
    data = {
        "center": '{"type":"Point","coordinates":[13.447265624999998,48.94415123418794]}',  # noqa
        "name": new_name,
    }
    response = client.post(url, data)
    assert response.status_code == 200
    assert Map.objects.get(pk=map.pk).name == new_name


@pytest.mark.usefixtures("allow_anonymous")
def test_anonymous_create(cookieclient, post_data):
    url = reverse("map_create")
    # POST only mendatory fields
    name = "test-map-with-new-name"
    post_data["name"] = name
    response = cookieclient.post(url, post_data)
    assert response.status_code == 200
    j = json.loads(response.content.decode())
    created_map = Map.objects.latest("pk")
    assert j["id"] == created_map.pk
    assert (
        created_map.get_anonymous_edit_url() in j["permissions"]["anonymous_edit_url"]
    )
    assert j["user"]["is_owner"] is True
    assert created_map.name == name
    key, value = created_map.signed_cookie_elements
    assert key in cookieclient.cookies


@pytest.mark.usefixtures("allow_anonymous")
def test_anonymous_update_without_cookie_fails(client, anonymap, post_data):
    url = reverse("map_update", kwargs={"map_id": anonymap.pk})
    response = client.post(url, post_data)
    assert response.status_code == 403


@pytest.mark.usefixtures("allow_anonymous")
def test_anonymous_update_with_cookie_should_work(cookieclient, anonymap, post_data):
    url = reverse("map_update", kwargs={"map_id": anonymap.pk})
    # POST only mendatory fields
    name = "new map name"
    post_data["name"] = name
    response = cookieclient.post(url, post_data)
    assert response.status_code == 200
    j = json.loads(response.content.decode())
    updated_map = Map.objects.get(pk=anonymap.pk)
    assert j["id"] == updated_map.pk


@pytest.mark.usefixtures("allow_anonymous")
def test_anonymous_delete(cookieclient, anonymap):
    url = reverse("map_delete", args=(anonymap.pk,))
    response = cookieclient.post(
        url, headers={"X-Requested-With": "XMLHttpRequest"}, follow=True
    )
    assert response.status_code == 200
    assert Map.objects.filter(pk=anonymap.pk).exists()
    reloaded = Map.objects.get(pk=anonymap.pk)
    assert reloaded.share_status == Map.DELETED
    # Test response is a json
    j = json.loads(response.content.decode())
    assert "redirect" in j


@pytest.mark.usefixtures("allow_anonymous")
def test_no_cookie_cannot_delete(client, anonymap):
    url = reverse("map_delete", args=(anonymap.pk,))
    response = client.post(
        url, headers={"X-Requested-With": "XMLHttpRequest"}, follow=True
    )
    assert response.status_code == 403


@pytest.mark.usefixtures("allow_anonymous")
def test_no_cookie_cannot_view_anonymous_owned_map_in_draft(client, anonymap):
    anonymap.share_status = Map.DRAFT
    anonymap.save()
    url = reverse("map", kwargs={"map_id": anonymap.pk, "slug": anonymap.slug})
    response = client.get(url)
    assert response.status_code == 403


@pytest.mark.usefixtures("allow_anonymous")
def test_owner_can_view_anonymous_owned_map_in_draft(cookieclient, anonymap):
    anonymap.share_status = Map.DRAFT
    anonymap.save()
    url = reverse("map", kwargs={"map_id": anonymap.pk, "slug": anonymap.slug})
    response = cookieclient.get(url)
    assert response.status_code == 200


@pytest.mark.usefixtures("allow_anonymous")
def test_anonymous_edit_url(cookieclient, anonymap):
    url = anonymap.get_anonymous_edit_url()
    canonical = reverse("map", kwargs={"map_id": anonymap.pk, "slug": anonymap.slug})
    response = cookieclient.get(url)
    assert response.status_code == 302
    assert response["Location"] == canonical
    key, value = anonymap.signed_cookie_elements
    assert key in cookieclient.cookies


@pytest.mark.usefixtures("allow_anonymous")
def test_sha1_anonymous_edit_url(cookieclient, anonymap):
    signer = Signer(algorithm="sha1")
    signature = signer.sign(anonymap.pk)
    url = reverse("map_anonymous_edit_url", kwargs={"signature": signature})
    canonical = reverse("map", kwargs={"map_id": anonymap.pk, "slug": anonymap.slug})
    response = cookieclient.get(url)
    assert response.status_code == 302
    assert response["Location"] == canonical
    key, value = anonymap.signed_cookie_elements
    assert key in cookieclient.cookies


@pytest.mark.usefixtures("allow_anonymous")
def test_bad_anonymous_edit_url_should_return_403(cookieclient, anonymap):
    url = anonymap.get_anonymous_edit_url()
    url = reverse(
        "map_anonymous_edit_url", kwargs={"signature": "%s:badsignature" % anonymap.pk}
    )
    response = cookieclient.get(url)
    assert response.status_code == 403


@pytest.mark.usefixtures("allow_anonymous")
def test_clone_anonymous_map_should_not_be_possible_if_user_is_not_allowed(
    client, anonymap, user
):
    assert Map.objects.count() == 1
    url = reverse("map_clone", kwargs={"map_id": anonymap.pk})
    anonymap.edit_status = anonymap.OWNER
    anonymap.save()
    response = client.post(url)
    assert response.status_code == 403
    client.login(username=user.username, password="123123")
    response = client.post(url)
    assert response.status_code == 403
    assert Map.objects.count() == 1


@pytest.mark.usefixtures("allow_anonymous")
def test_clone_map_should_be_possible_if_edit_status_is_anonymous(client, anonymap):
    assert Map.objects.count() == 1
    url = reverse("map_clone", kwargs={"map_id": anonymap.pk})
    anonymap.edit_status = anonymap.ANONYMOUS
    anonymap.save()
    response = client.post(url)
    assert response.status_code == 302
    assert Map.objects.count() == 2
    clone = Map.objects.latest("pk")
    assert response["Location"] == clone.get_absolute_url()
    assert clone.pk != anonymap.pk
    assert clone.name == "Clone of " + anonymap.name
    assert clone.owner is None


@pytest.mark.usefixtures("allow_anonymous")
def test_anyone_can_access_anonymous_map(cookieclient, anonymap):
    url = reverse("map", args=(anonymap.slug, anonymap.pk))
    anonymap.share_status = anonymap.PUBLIC
    response = cookieclient.get(url)
    assert response.status_code == 200
    anonymap.share_status = anonymap.OPEN
    response = cookieclient.get(url)
    assert response.status_code == 200
    anonymap.share_status = anonymap.PRIVATE
    response = cookieclient.get(url)
    assert response.status_code == 200


@pytest.mark.usefixtures("allow_anonymous")
def test_map_attach_owner(cookieclient, anonymap, user):
    url = reverse("map_attach_owner", kwargs={"map_id": anonymap.pk})
    cookieclient.login(username=user.username, password="123123")
    assert anonymap.owner is None
    response = cookieclient.post(url)
    assert response.status_code == 200
    map = Map.objects.get(pk=anonymap.pk)
    assert map.owner == user


@pytest.mark.usefixtures("allow_anonymous")
def test_map_attach_owner_not_logged_in(cookieclient, anonymap, user):
    url = reverse("map_attach_owner", kwargs={"map_id": anonymap.pk})
    assert anonymap.owner is None
    response = cookieclient.post(url)
    assert response.status_code == 403


@pytest.mark.usefixtures("allow_anonymous")
def test_map_attach_owner_with_already_an_owner(cookieclient, map, user):
    url = reverse("map_attach_owner", kwargs={"map_id": map.pk})
    cookieclient.login(username=user.username, password="123123")
    assert map.owner
    assert map.owner != user
    response = cookieclient.post(url)
    assert response.status_code == 403


def test_map_attach_owner_anonymous_not_allowed(cookieclient, anonymap, user):
    url = reverse("map_attach_owner", kwargs={"map_id": anonymap.pk})
    cookieclient.login(username=user.username, password="123123")
    assert anonymap.owner is None
    response = cookieclient.post(url)
    assert response.status_code == 403

    # # GET anonymous
    # response = client.get(url)
    # assert login_required(response)
    # # POST anonymous
    # response = client.post(url, {})
    # assert login_required(response)
    # # GET with wrong permissions
    # client.login(username=user.username, password="123123")
    # response = client.get(url)
    # assert response.status_code == 403
    # # POST with wrong permissions
    # client.login(username=user.username, password="123123")
    # response = client.post(url, {})
    # assert response.status_code == 403


def test_create_readonly(client, user, post_data, settings):
    settings.UMAP_READONLY = True
    url = reverse("map_create")
    client.login(username=user.username, password="123123")
    response = client.post(url, post_data)
    assert response.status_code == 403
    assert response.content == b"Site is readonly for maintenance"


def test_authenticated_user_can_star_map(client, map, user):
    url = reverse("map_star", args=(map.pk,))
    client.login(username=user.username, password="123123")
    assert Star.objects.filter(by=user).count() == 0
    response = client.post(url)
    assert response.status_code == 200
    assert Star.objects.filter(by=user).count() == 1


def test_anonymous_cannot_star_map(client, map):
    url = reverse("map_star", args=(map.pk,))
    assert Star.objects.count() == 0
    response = client.post(url)
    assert response.status_code == 302
    assert "login" in response["Location"]
    assert Star.objects.count() == 0


def test_user_can_see_their_star(client, map, user):
    url = reverse("map_star", args=(map.pk,))
    client.login(username=user.username, password="123123")
    assert Star.objects.filter(by=user).count() == 0
    response = client.post(url)
    assert response.status_code == 200
    url = reverse("user_stars", args=(user.username,))
    response = client.get(url)
    assert response.status_code == 200
    assert map.name in response.content.decode()


def test_stars_link(client, map, user):
    client.login(username=user.username, password="123123")
    response = client.get(reverse("home"))
    assert response.status_code == 200
    assert "/user/Joe/stars" in response.content.decode()


@pytest.mark.usefixtures("allow_anonymous")
def test_cannot_send_link_on_owned_map(client, map):
    assert len(mail.outbox) == 0
    url = reverse("map_send_edit_link", args=(map.pk,))
    resp = client.post(url, {"email": "foo@bar.org"})
    assert resp.status_code == 200
    assert json.loads(resp.content.decode()) == {"login_required": "/en/login/"}
    assert len(mail.outbox) == 0


@pytest.mark.usefixtures("allow_anonymous")
def test_cannot_send_link_on_anonymous_map_without_cookie(client, anonymap):
    assert len(mail.outbox) == 0
    url = reverse("map_send_edit_link", args=(anonymap.pk,))
    resp = client.post(url, {"email": "foo@bar.org"})
    assert resp.status_code == 403
    assert len(mail.outbox) == 0


@pytest.mark.usefixtures("allow_anonymous")
def test_can_send_link_on_anonymous_map_with_cookie(cookieclient, anonymap):
    assert len(mail.outbox) == 0
    url = reverse("map_send_edit_link", args=(anonymap.pk,))
    resp = cookieclient.post(url, {"email": "foo@bar.org"})
    assert resp.status_code == 200
    assert len(mail.outbox) == 1
    assert mail.outbox[0].subject == "The uMap edit link for your map: test map"


def test_download(client, map, datalayer):
    url = reverse("map_download", args=(map.pk,))
    response = client.get(url)
    assert response.status_code == 200
    # Test response is a json
    j = json.loads(response.content.decode())
    assert j["type"] == "umap"
    assert j["uri"] == f"http://testserver/en/map/test-map_{map.pk}"
    assert j["geometry"] == {
        "coordinates": [13.447265624999998, 48.94415123418794],
        "type": "Point",
    }
    assert j["properties"] == {
        "datalayersControl": True,
        "description": "Which is just the Danube, at the end",
        "displayPopupFooter": False,
        "licence": "",
        "miniMap": False,
        "moreControl": True,
        "name": "test map",
        "scaleControl": True,
        "tilelayer": {
            "attribution": "© OSM Contributors",
            "maxZoom": 18,
            "minZoom": 0,
            "url_template": "https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
        },
        "tilelayersControl": True,
        "zoom": 7,
        "zoomControl": True,
    }
    assert j["layers"] == [
        {
            "_umap_options": {
                "browsable": True,
                "displayOnLoad": True,
                "name": "test datalayer",
            },
            "features": [
                {
                    "geometry": {
                        "coordinates": [14.68896484375, 48.55297816440071],
                        "type": "Point",
                    },
                    "id": "ExNTQ",
                    "properties": {
                        "_umap_options": {"color": "DarkCyan", "iconClass": "Ball"},
                        "description": "Da place anonymous again 755",
                        "name": "Here",
                    },
                    "type": "Feature",
                }
            ],
            "type": "FeatureCollection",
        },
    ]


def test_download_multiple_maps(client, map, datalayer):
    map.share_status = Map.PRIVATE
    map.save()
    another_map = MapFactory(
        owner=map.owner, name="Another map", share_status=Map.PUBLIC
    )
    client.login(username=map.owner.username, password="123123")
    url = reverse("user_download")
    response = client.get(f"{url}?map_id={map.id}&map_id={another_map.id}")
    assert response.status_code == 200
    with zipfile.ZipFile(file=BytesIO(response.content), mode="r") as f:
        assert len(f.infolist()) == 2
        assert f.infolist()[0].filename == f"umap_backup_test-map_{another_map.id}.umap"
        assert f.infolist()[1].filename == f"umap_backup_test-map_{map.id}.umap"
        with f.open(f.infolist()[1]) as umap_file:
            umapjson = json.loads(umap_file.read().decode())
            assert list(umapjson.keys()) == [
                "type",
                "geometry",
                "properties",
                "uri",
                "layers",
            ]
            assert umapjson["type"] == "umap"
            assert umapjson["uri"] == f"http://testserver/en/map/test-map_{map.id}"


def test_download_multiple_maps_unauthorized(client, map, datalayer):
    map.share_status = Map.PRIVATE
    map.save()
    user1 = UserFactory(username="user1")
    another_map = MapFactory(owner=user1, name="Another map", share_status=Map.PUBLIC)
    client.login(username=map.owner.username, password="123123")
    url = reverse("user_download")
    response = client.get(f"{url}?map_id={map.id}&map_id={another_map.id}")
    assert response.status_code == 200
    with zipfile.ZipFile(file=BytesIO(response.content), mode="r") as f:
        assert len(f.infolist()) == 1
        assert f.infolist()[0].filename == f"umap_backup_test-map_{map.id}.umap"


def test_download_multiple_maps_editor(client, map, datalayer):
    map.share_status = Map.PRIVATE
    map.save()
    user1 = UserFactory(username="user1")
    another_map = MapFactory(owner=user1, name="Another map", share_status=Map.PUBLIC)
    another_map.editors.add(map.owner)
    another_map.save()
    client.login(username=map.owner.username, password="123123")
    url = reverse("user_download")
    response = client.get(f"{url}?map_id={map.id}&map_id={another_map.id}")
    assert response.status_code == 200
    with zipfile.ZipFile(file=BytesIO(response.content), mode="r") as f:
        assert len(f.infolist()) == 2
        assert f.infolist()[0].filename == f"umap_backup_test-map_{another_map.id}.umap"
        assert f.infolist()[1].filename == f"umap_backup_test-map_{map.id}.umap"


@pytest.mark.parametrize(
    "share_status", [Map.PRIVATE, Map.BLOCKED, Map.DRAFT, Map.DELETED]
)
def test_download_shared_status_map(client, map, datalayer, share_status):
    map.share_status = share_status
    map.save()
    url = reverse("map_download", args=(map.pk,))
    response = client.get(url)
    assert response.status_code == 403


@pytest.mark.parametrize("share_status", [Map.PRIVATE, Map.DRAFT])
def test_download_my_map(client, map, datalayer, share_status):
    map.share_status = share_status
    map.save()
    client.login(username=map.owner.username, password="123123")
    url = reverse("map_download", args=(map.pk,))
    response = client.get(url)
    assert response.status_code == 200
    # Test response is a json
    j = json.loads(response.content.decode())
    assert j["type"] == "umap"


@pytest.mark.parametrize("share_status", [Map.BLOCKED, Map.DELETED])
def test_download_my_map_blocked_or_deleted(client, map, datalayer, share_status):
    map.share_status = share_status
    map.save()
    client.login(username=map.owner.username, password="123123")
    url = reverse("map_download", args=(map.pk,))
    response = client.get(url)
    assert response.status_code == 403


@pytest.mark.parametrize(
    "share_status", [Map.PRIVATE, Map.BLOCKED, Map.OPEN, Map.DRAFT]
)
def test_oembed_shared_status_map(client, map, datalayer, share_status):
    map.share_status = share_status
    map.save()
    url = f"{reverse('map_oembed')}?url=http://testserver{map.get_absolute_url()}"
    response = client.get(url)
    assert response.status_code == 403


def test_download_does_not_include_delete_datalayers(client, map, datalayer):
    datalayer.share_status = DataLayer.DELETED
    datalayer.save()
    url = reverse("map_download", args=(map.pk,))
    response = client.get(url)
    assert response.status_code == 200
    # Test response is a json
    j = json.loads(response.content.decode())
    assert j["layers"] == []


def test_oembed_no_url_map(client, map, datalayer):
    url = reverse("map_oembed")
    response = client.get(url)
    assert response.status_code == 404


def test_oembed_unknown_url_map(client, map, datalayer):
    map_url = f"http://testserver{map.get_absolute_url()}"
    # We change to an unknown id prefix to keep URL structure.
    map_url = map_url.replace("map_", "_111")
    url = f"{reverse('map_oembed')}?url={map_url}"
    response = client.get(url)
    assert response.status_code == 404


def test_oembed_wrong_format_map(client, map, datalayer):
    url = (
        f"{reverse('map_oembed')}"
        f"?url=http://testserver{map.get_absolute_url()}&format=xml"
    )
    response = client.get(url)
    assert response.status_code == 501


def test_oembed_wrong_domain_map(client, map, datalayer):
    url = f"{reverse('map_oembed')}?url=http://BADserver{map.get_absolute_url()}"
    response = client.get(url)
    assert response.status_code == 404


def test_oembed_map(client, map, datalayer):
    url = f"{reverse('map_oembed')}?url=http://testserver{map.get_absolute_url()}"
    response = client.get(url)
    assert response.status_code == 200
    assert response.headers["Access-Control-Allow-Origin"] == "*"
    j = json.loads(response.content.decode())
    assert j["type"] == "rich"
    assert j["version"] == "1.0"
    assert j["width"] == 800
    assert j["height"] == 300
    assert j["html"] == (
        '<iframe width="100%" height="300px" frameborder="0" allowfullscreen '
        f'allow="geolocation" src="//testserver/en/map/test-map_{map.id}"></iframe>'
        f'<p><a href="//testserver/en/map/test-map_{map.id}">See full screen</a></p>'
    )


def test_oembed_map_with_non_default_language(client, map, datalayer):
    translation.activate("en")
    path = map.get_absolute_url()
    assert path.startswith("/en/")
    path = path.replace("/en/", "/fr/")
    url = f"{reverse('map_oembed')}?url=http://testserver{path}"
    response = client.get(url)
    assert response.status_code == 200
    translation.activate("en")


def test_oembed_link(client, map, datalayer):
    response = client.get(map.get_absolute_url())
    assert response.status_code == 200

    assert (
        '<link rel="alternate"\n        type="application/json+oembed"'
    ) in response.content.decode()
    assert (
        'href="http://testserver/map/oembed/'
        f'?url=http%3A%2F%2Ftestserver%2Fen%2Fmap%2Ftest-map_{map.id}&format=json"'
    ) in response.content.decode()
    assert 'title="test map oEmbed URL" />' in response.content.decode()


def test_ogp_links(client, map, datalayer):
    response = client.get(map.get_absolute_url())
    assert response.status_code == 200
    content = response.content.decode()
    assert (
        f'<meta property="og:url" content="http://umap.org{map.get_absolute_url()}" />'
        in content
    )
    assert f'<meta property="og:title" content="{map.name}" />' in content
    assert f'<meta property="og:description" content="{map.description}" />' in content
    assert '<meta property="og:site_name" content="uMap" />' in content


def test_non_public_map_should_have_noindex_meta(client, map, datalayer):
    map.share_status = Map.OPEN
    map.save()
    response = client.get(map.get_absolute_url())
    assert response.status_code == 200
    assert (
        '<meta name="robots" content="noindex,nofollow">' in response.content.decode()
    )


def test_demo_instance_should_have_noindex(client, map, datalayer, settings):
    settings.UMAP_DEMO_SITE = True
    response = client.get(map.get_absolute_url())
    assert response.status_code == 200
    assert (
        '<meta name="robots" content="noindex,nofollow">' in response.content.decode()
    )
