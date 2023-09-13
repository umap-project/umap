import pytest
from django.contrib.auth.models import AnonymousUser
from django.urls import reverse

from umap.models import Map

from .base import MapFactory

pytestmark = pytest.mark.django_db


def test_anonymous_cannot_edit(map):
    anonymous = AnonymousUser()
    assert not map.can_edit(anonymous)


def test_non_editors_cannot_edit(map, user):
    assert map.owner != user
    assert not map.can_edit(user)


def test_editors_can_edit(map, user):
    map.editors.add(user)
    map.save()
    assert map.can_edit(user)


def test_owner_can_edit(map):
    assert map.can_edit(map.owner)


def test_logged_in_user_should_not_be_allowed_for_anonymous_map(map, user, rf):
    map.owner = None
    map.save()
    url = reverse('map_update', kwargs={'map_id': map.pk})
    request = rf.get(url)
    request.user = user
    assert not map.can_edit(user, request)


def test_clone_should_return_new_instance(map, user):
    clone = map.clone()
    assert map.pk != clone.pk
    assert u"Clone of " + map.name == clone.name
    assert map.settings == clone.settings
    assert map.center == clone.center
    assert map.zoom == clone.zoom
    assert map.licence == clone.licence


def test_clone_should_keep_editors(map, user):
    map.editors.add(user)
    clone = map.clone()
    assert map.pk != clone.pk
    assert user in map.editors.all()
    assert user in clone.editors.all()


def test_clone_should_update_owner_if_passed(map, user):
    clone = map.clone(owner=user)
    assert map.pk != clone.pk
    assert map.owner != clone.owner
    assert user == clone.owner


def test_clone_should_clone_datalayers_and_features_too(map, user, datalayer):
    clone = map.clone()
    assert map.pk != clone.pk
    assert map.datalayer_set.count() == 1
    assert clone.datalayer_set.count() == 1
    other = clone.datalayer_set.all()[0]
    assert datalayer in map.datalayer_set.all()
    assert other.pk != datalayer.pk
    assert other.name == datalayer.name
    assert other.geojson is not None
    assert other.geojson.path != datalayer.geojson.path


def test_publicmanager_should_get_only_public_maps(map, user, licence):
    map.share_status = map.PUBLIC
    open_map = MapFactory(owner=user, licence=licence, share_status=Map.OPEN)
    private_map = MapFactory(owner=user, licence=licence,
                             share_status=Map.PRIVATE)
    assert map in Map.public.all()
    assert open_map not in Map.public.all()
    assert private_map not in Map.public.all()


def test_can_change_default_share_status(user, settings):
    map = MapFactory(owner=user)
    assert map.share_status == Map.PUBLIC
    settings.UMAP_DEFAULT_SHARE_STATUS = Map.PRIVATE
    map = MapFactory(owner=user)
    assert map.share_status == Map.PRIVATE
