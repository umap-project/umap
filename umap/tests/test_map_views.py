import json

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from umap.models import DataLayer, Map

from .base import login_required

pytestmark = pytest.mark.django_db
User = get_user_model()


@pytest.fixture
def post_data():
    return {
        'name': 'name',
        'center': '{"type":"Point","coordinates":[13.447265624999998,48.94415123418794]}',  # noqa
        'settings': '{"type":"Feature","geometry":{"type":"Point","coordinates":[5.0592041015625,52.05924589011585]},"properties":{"tilelayer":{"maxZoom":20,"url_template":"http://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png","minZoom":0,"attribution":"HOT and friends"},"licence":"","description":"","name":"test enrhûmé","tilelayersControl":true,"displayDataBrowserOnLoad":false,"displayPopupFooter":true,"displayCaptionOnLoad":false,"miniMap":true,"moreControl":true,"scaleControl":true,"zoomControl":true,"datalayersControl":true,"zoom":8}}'  # noqa
    }


def test_create(client, user, post_data):
    url = reverse('map_create')
    # POST only mendatory fields
    name = 'test-map-with-new-name'
    post_data['name'] = name
    client.login(username=user.username, password="123123")
    response = client.post(url, post_data)
    assert response.status_code == 200
    j = json.loads(response.content.decode())
    created_map = Map.objects.latest('pk')
    assert j['id'] == created_map.pk
    assert created_map.name == name
    assert created_map.center.x == 13.447265624999998
    assert created_map.center.y == 48.94415123418794
    assert j['permissions'] == {
        'edit_status': 3,
        'share_status': 1,
        'owner': {
            'id': user.pk,
            'name': 'Joe',
            'url': '/en/user/Joe/'
        },
        'editors': [],
        'anonymous_edit_url': ('http://umap.org'
                               + created_map.get_anonymous_edit_url())
    }


def test_map_create_permissions(client, settings):
    settings.UMAP_ALLOW_ANONYMOUS = False
    url = reverse('map_create')
    # POST anonymous
    response = client.post(url, {})
    assert login_required(response)


def test_map_update_access(client, map, user):
    url = reverse('map_update', kwargs={'map_id': map.pk})
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
    url = reverse('map_update_permissions', kwargs={'map_id': map.pk})
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
    url = reverse('map_update', kwargs={'map_id': map.pk})
    # POST only mendatory fields
    name = 'new map name'
    post_data['name'] = name
    client.login(username=map.owner.username, password="123123")
    response = client.post(url, post_data)
    assert response.status_code == 200
    j = json.loads(response.content.decode())
    assert 'html' not in j
    updated_map = Map.objects.get(pk=map.pk)
    assert j['id'] == updated_map.pk
    assert updated_map.name == name


def test_delete(client, map, datalayer):
    url = reverse('map_delete', args=(map.pk, ))
    client.login(username=map.owner.username, password="123123")
    response = client.post(url, {}, follow=True)
    assert response.status_code == 200
    assert not Map.objects.filter(pk=map.pk).exists()
    assert not DataLayer.objects.filter(pk=datalayer.pk).exists()
    # Check that user has not been impacted
    assert User.objects.filter(pk=map.owner.pk).exists()
    # Test response is a json
    j = json.loads(response.content.decode())
    assert 'redirect' in j


def test_wrong_slug_should_redirect_to_canonical(client, map):
    url = reverse('map', kwargs={'pk': map.pk, 'slug': 'wrong-slug'})
    canonical = reverse('map', kwargs={'pk': map.pk,
                                       'slug': map.slug})
    response = client.get(url)
    assert response.status_code == 301
    assert response['Location'] == canonical


def test_wrong_slug_should_redirect_with_query_string(client, map):
    url = reverse('map', kwargs={'pk': map.pk, 'slug': 'wrong-slug'})
    url = "{}?allowEdit=0".format(url)
    canonical = reverse('map', kwargs={'pk': map.pk,
                                       'slug': map.slug})
    canonical = "{}?allowEdit=0".format(canonical)
    response = client.get(url)
    assert response.status_code == 301
    assert response['Location'] == canonical


def test_should_not_consider_the_query_string_for_canonical_check(client, map):
    url = reverse('map', kwargs={'pk': map.pk, 'slug': map.slug})
    url = "{}?allowEdit=0".format(url)
    response = client.get(url)
    assert response.status_code == 200


def test_short_url_should_redirect_to_canonical(client, map):
    url = reverse('map_short_url', kwargs={'pk': map.pk})
    canonical = reverse('map', kwargs={'pk': map.pk,
                                       'slug': map.slug})
    response = client.get(url)
    assert response.status_code == 301
    assert response['Location'] == canonical


def test_clone_map_should_create_a_new_instance(client, map):
    assert Map.objects.count() == 1
    url = reverse('map_clone', kwargs={'map_id': map.pk})
    client.login(username=map.owner.username, password="123123")
    response = client.post(url)
    assert response.status_code == 200
    assert Map.objects.count() == 2
    clone = Map.objects.latest('pk')
    assert clone.pk != map.pk
    assert clone.name == u"Clone of " + map.name


def test_user_not_allowed_should_not_clone_map(client, map, user, settings):
    settings.UMAP_ALLOW_ANONYMOUS = False
    assert Map.objects.count() == 1
    url = reverse('map_clone', kwargs={'map_id': map.pk})
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
    url = reverse('map_clone', kwargs={'map_id': map.pk})
    map.edit_status = map.EDITORS
    map.editors.add(user)
    map.save()
    client.login(username=user.username, password="123123")
    response = client.post(url)
    assert response.status_code == 200
    assert Map.objects.count() == 2
    clone = Map.objects.latest('pk')
    assert clone.pk != map.pk
    assert clone.name == u"Clone of " + map.name
    assert clone.owner == user


def test_map_creation_should_allow_unicode_names(client, map, post_data):
    url = reverse('map_create')
    # POST only mendatory fields
    name = u'Академический'
    post_data['name'] = name
    client.login(username=map.owner.username, password="123123")
    response = client.post(url, post_data)
    assert response.status_code == 200
    j = json.loads(response.content.decode())
    created_map = Map.objects.latest('pk')
    assert j['id'] == created_map.pk
    assert created_map.name == name
    # Lower case of the russian original name
    # self.assertEqual(created_map.slug, u"академический")
    # for now we fallback to "map", see unicode_name branch
    assert created_map.slug == 'map'


def test_anonymous_can_access_map_with_share_status_public(client, map):
    url = reverse('map', args=(map.slug, map.pk))
    map.share_status = map.PUBLIC
    map.save()
    response = client.get(url)
    assert response.status_code == 200


def test_anonymous_can_access_map_with_share_status_open(client, map):
    url = reverse('map', args=(map.slug, map.pk))
    map.share_status = map.OPEN
    map.save()
    response = client.get(url)
    assert response.status_code == 200


def test_anonymous_cannot_access_map_with_share_status_private(client, map):
    url = reverse('map', args=(map.slug, map.pk))
    map.share_status = map.PRIVATE
    map.save()
    response = client.get(url)
    assert response.status_code == 403


def test_owner_can_access_map_with_share_status_private(client, map):
    url = reverse('map', args=(map.slug, map.pk))
    map.share_status = map.PRIVATE
    map.save()
    client.login(username=map.owner.username, password="123123")
    response = client.get(url)
    assert response.status_code == 200


def test_editors_can_access_map_with_share_status_private(client, map, user):
    url = reverse('map', args=(map.slug, map.pk))
    map.share_status = map.PRIVATE
    map.editors.add(user)
    map.save()
    client.login(username=user.username, password="123123")
    response = client.get(url)
    assert response.status_code == 200


def test_non_editor_cannot_access_map_if_share_status_private(client, map, user):  # noqa
    url = reverse('map', args=(map.slug, map.pk))
    map.share_status = map.PRIVATE
    map.save()
    client.login(username=user.username, password="123123")
    response = client.get(url)
    assert response.status_code == 403


def test_map_geojson_view(client, map):
    url = reverse('map_geojson', args=(map.pk, ))
    response = client.get(url)
    j = json.loads(response.content.decode())
    assert 'json' in response['content-type']
    assert 'type' in j


def test_only_owner_can_delete(client, map, user):
    map.editors.add(user)
    url = reverse('map_delete', kwargs={'map_id': map.pk})
    client.login(username=user.username, password="123123")
    response = client.post(url, {}, follow=True)
    assert response.status_code == 403


def test_map_editors_do_not_see_owner_change_input(client, map, user):
    map.editors.add(user)
    map.edit_status = map.EDITORS
    map.save()
    url = reverse('map_update_permissions', kwargs={'map_id': map.pk})
    client.login(username=user.username, password="123123")
    response = client.get(url)
    assert 'id_owner' not in response


def test_logged_in_user_can_edit_map_editable_by_anonymous(client, map, user):
    map.owner = None
    map.edit_status = map.ANONYMOUS
    map.save()
    client.login(username=user.username, password="123123")
    url = reverse('map_update', kwargs={'map_id': map.pk})
    new_name = 'this is my new name'
    data = {
        'center': '{"type":"Point","coordinates":[13.447265624999998,48.94415123418794]}',  # noqa
        'name': new_name
    }
    response = client.post(url, data)
    assert response.status_code == 200
    assert Map.objects.get(pk=map.pk).name == new_name


@pytest.mark.usefixtures('allow_anonymous')
def test_anonymous_create(cookieclient, post_data):
    url = reverse('map_create')
    # POST only mendatory fields
    name = 'test-map-with-new-name'
    post_data['name'] = name
    response = cookieclient.post(url, post_data)
    assert response.status_code == 200
    j = json.loads(response.content.decode())
    created_map = Map.objects.latest('pk')
    assert j['id'] == created_map.pk
    assert (created_map.get_anonymous_edit_url()
            in j['permissions']['anonymous_edit_url'])
    assert created_map.name == name
    key, value = created_map.signed_cookie_elements
    assert key in cookieclient.cookies


@pytest.mark.usefixtures('allow_anonymous')
def test_anonymous_update_without_cookie_fails(client, anonymap, post_data):  # noqa
    url = reverse('map_update', kwargs={'map_id': anonymap.pk})
    response = client.post(url, post_data)
    assert response.status_code == 403


@pytest.mark.usefixtures('allow_anonymous')
def test_anonymous_update_with_cookie_should_work(cookieclient, anonymap, post_data):  # noqa
    url = reverse('map_update', kwargs={'map_id': anonymap.pk})
    # POST only mendatory fields
    name = 'new map name'
    post_data['name'] = name
    response = cookieclient.post(url, post_data)
    assert response.status_code == 200
    j = json.loads(response.content.decode())
    updated_map = Map.objects.get(pk=anonymap.pk)
    assert j['id'] == updated_map.pk


@pytest.mark.usefixtures('allow_anonymous')
def test_anonymous_delete(cookieclient, anonymap):
    url = reverse('map_delete', args=(anonymap.pk, ))
    response = cookieclient.post(url, {}, follow=True)
    assert response.status_code == 200
    assert not Map.objects.filter(pk=anonymap.pk).count()
    # Test response is a json
    j = json.loads(response.content.decode())
    assert 'redirect' in j


@pytest.mark.usefixtures('allow_anonymous')
def test_no_cookie_cant_delete(client, anonymap):
    url = reverse('map_delete', args=(anonymap.pk, ))
    response = client.post(url, {}, follow=True)
    assert response.status_code == 403


@pytest.mark.usefixtures('allow_anonymous')
def test_anonymous_edit_url(cookieclient, anonymap):
    url = anonymap.get_anonymous_edit_url()
    canonical = reverse('map', kwargs={'pk': anonymap.pk,
                                       'slug': anonymap.slug})
    response = cookieclient.get(url)
    assert response.status_code == 302
    assert response['Location'] == canonical
    key, value = anonymap.signed_cookie_elements
    assert key in cookieclient.cookies


@pytest.mark.usefixtures('allow_anonymous')
def test_bad_anonymous_edit_url_should_return_403(cookieclient, anonymap):
    url = anonymap.get_anonymous_edit_url()
    url = reverse(
        'map_anonymous_edit_url',
        kwargs={'signature': "%s:badsignature" % anonymap.pk}
    )
    response = cookieclient.get(url)
    assert response.status_code == 403


@pytest.mark.usefixtures('allow_anonymous')
def test_clone_anonymous_map_should_not_be_possible_if_user_is_not_allowed(client, anonymap, user):  # noqa
    assert Map.objects.count() == 1
    url = reverse('map_clone', kwargs={'map_id': anonymap.pk})
    anonymap.edit_status = anonymap.OWNER
    anonymap.save()
    response = client.post(url)
    assert response.status_code == 403
    client.login(username=user.username, password="123123")
    response = client.post(url)
    assert response.status_code == 403
    assert Map.objects.count() == 1


@pytest.mark.usefixtures('allow_anonymous')
def test_clone_map_should_be_possible_if_edit_status_is_anonymous(client, anonymap):  # noqa
    assert Map.objects.count() == 1
    url = reverse('map_clone', kwargs={'map_id': anonymap.pk})
    anonymap.edit_status = anonymap.ANONYMOUS
    anonymap.save()
    response = client.post(url)
    assert response.status_code == 200
    assert Map.objects.count() == 2
    clone = Map.objects.latest('pk')
    assert clone.pk != anonymap.pk
    assert clone.name == 'Clone of ' + anonymap.name
    assert clone.owner is None


@pytest.mark.usefixtures('allow_anonymous')
def test_anyone_can_access_anonymous_map(cookieclient, anonymap):
    url = reverse('map', args=(anonymap.slug, anonymap.pk))
    anonymap.share_status = anonymap.PUBLIC
    response = cookieclient.get(url)
    assert response.status_code == 200
    anonymap.share_status = anonymap.OPEN
    response = cookieclient.get(url)
    assert response.status_code == 200
    anonymap.share_status = anonymap.PRIVATE
    response = cookieclient.get(url)
    assert response.status_code == 200


@pytest.mark.usefixtures('allow_anonymous')
def test_map_attach_owner(cookieclient, anonymap, user):
    url = reverse('map_attach_owner', kwargs={'map_id': anonymap.pk})
    cookieclient.login(username=user.username, password="123123")
    assert anonymap.owner is None
    response = cookieclient.post(url)
    assert response.status_code == 200
    map = Map.objects.get(pk=anonymap.pk)
    assert map.owner == user


@pytest.mark.usefixtures('allow_anonymous')
def test_map_attach_owner_not_logged_in(cookieclient, anonymap, user):
    url = reverse('map_attach_owner', kwargs={'map_id': anonymap.pk})
    assert anonymap.owner is None
    response = cookieclient.post(url)
    assert response.status_code == 403


@pytest.mark.usefixtures('allow_anonymous')
def test_map_attach_owner_with_already_an_owner(cookieclient, map, user):
    url = reverse('map_attach_owner', kwargs={'map_id': map.pk})
    cookieclient.login(username=user.username, password="123123")
    assert map.owner
    assert map.owner != user
    response = cookieclient.post(url)
    assert response.status_code == 403


def test_map_attach_owner_anonymous_not_allowed(cookieclient, anonymap, user):
    url = reverse('map_attach_owner', kwargs={'map_id': anonymap.pk})
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
    url = reverse('map_create')
    client.login(username=user.username, password="123123")
    response = client.post(url, post_data)
    assert response.status_code == 403
    assert response.content == b'Site is readonly for maintenance'
