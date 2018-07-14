import pytest
from django.contrib.auth.models import AnonymousUser
from django.urls import reverse

from umap.models import Map

from .base import MapFactory

pytestmark = pytest.mark.django_db


def test_anonymous_can_edit_if_status_anonymous(map):
    anonymous = AnonymousUser()
    map.edit_status = map.ANONYMOUS
    map.save()
    assert map.can_edit(anonymous)


def test_anonymous_cannot_edit_if_not_status_anonymous(map):
    anonymous = AnonymousUser()
    map.edit_status = map.OWNER
    map.save()
    assert not map.can_edit(anonymous)


def test_non_editors_can_edit_if_status_anonymous(map, user):
    assert map.owner != user
    map.edit_status = map.ANONYMOUS
    map.save()
    assert map.can_edit(user)


def test_non_editors_cannot_edit_if_not_status_anonymous(map, user):
    map.edit_status = map.OWNER
    map.save()
    assert not map.can_edit(user)


def test_editors_cannot_edit_if_status_owner(map, user):
    map.edit_status = map.OWNER
    map.editors.add(user)
    map.save()
    assert not map.can_edit(user)


def test_editors_can_edit_if_status_editors(map, user):
    map.edit_status = map.EDITORS
    map.editors.add(user)
    map.save()
    assert map.can_edit(user)


def test_logged_in_user_should_be_allowed_for_anonymous_map_with_anonymous_edit_status(map, user, rf):  # noqa
    map.owner = None
    map.edit_status = map.ANONYMOUS
    map.save()
    url = reverse('map_update', kwargs={'map_id': map.pk})
    request = rf.get(url)
    request.user = user
    assert map.can_edit(user, request)


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
