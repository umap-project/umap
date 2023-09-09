import os

import pytest
from django.core.files.base import ContentFile

from .base import DataLayerFactory, MapFactory
from umap.models import DataLayer

pytestmark = pytest.mark.django_db


def test_datalayers_should_be_ordered_by_rank(map, datalayer):
    datalayer.rank = 5
    datalayer.save()
    c4 = DataLayerFactory(map=map, rank=4)
    c1 = DataLayerFactory(map=map, rank=1)
    c3 = DataLayerFactory(map=map, rank=3)
    c2 = DataLayerFactory(map=map, rank=2)
    assert list(map.datalayer_set.all()) == [c1, c2, c3, c4, datalayer]


def test_upload_to(map, datalayer):
    map.pk = 302
    datalayer.pk = 17
    assert datalayer.upload_to().startswith("datalayer/2/0/302/17_")


def test_save_should_use_pk_as_name(map, datalayer):
    assert "/{}_".format(datalayer.pk) in datalayer.geojson.name


def test_same_geojson_file_name_will_be_suffixed(map, datalayer):
    before = datalayer.geojson.name
    datalayer.geojson.save(before, ContentFile("{}"))
    assert datalayer.geojson.name != before
    assert "/{}_".format(datalayer.pk) in datalayer.geojson.name


def test_clone_should_return_new_instance(map, datalayer):
    clone = datalayer.clone()
    assert datalayer.pk != clone.pk
    assert datalayer.name == clone.name
    assert datalayer.map == clone.map


def test_clone_should_update_map_if_passed(datalayer, user, licence):
    map = MapFactory(owner=user, licence=licence)
    clone = datalayer.clone(map_inst=map)
    assert datalayer.pk != clone.pk
    assert datalayer.name == clone.name
    assert datalayer.map != clone.map
    assert map == clone.map


def test_clone_should_clone_geojson_too(datalayer):
    clone = datalayer.clone()
    assert datalayer.pk != clone.pk
    assert clone.geojson is not None
    assert clone.geojson.path != datalayer.geojson.path


def test_should_remove_old_versions_on_save(datalayer, map, settings):
    settings.UMAP_KEEP_VERSIONS = 3
    root = datalayer.storage_root()
    before = len(datalayer.geojson.storage.listdir(root)[1])
    newer = "%s/%s_1440924889.geojson" % (root, datalayer.pk)
    medium = "%s/%s_1440923687.geojson" % (root, datalayer.pk)
    older = "%s/%s_1440918637.geojson" % (root, datalayer.pk)
    for path in [medium, newer, older]:
        datalayer.geojson.storage.save(path, ContentFile("{}"))
        datalayer.geojson.storage.save(path + ".gz", ContentFile("{}"))
    assert len(datalayer.geojson.storage.listdir(root)[1]) == 6 + before
    datalayer.save()
    files = datalayer.geojson.storage.listdir(root)[1]
    assert len(files) == 5
    assert os.path.basename(newer) in files
    assert os.path.basename(newer + ".gz") in files
    assert os.path.basename(medium) in files
    assert os.path.basename(medium + ".gz") in files
    assert os.path.basename(datalayer.geojson.path) in files
    assert os.path.basename(older) not in files
    assert os.path.basename(older + ".gz") not in files


def test_anonymous_cannot_edit_in_editors_mode(datalayer):
    datalayer.edit_status = DataLayer.EDITORS
    datalayer.save()
    assert not datalayer.can_edit()


def test_owner_can_edit_in_editors_mode(datalayer, user):
    datalayer.edit_status = DataLayer.EDITORS
    datalayer.save()
    assert datalayer.can_edit(datalayer.map.owner)


def test_editor_can_edit_in_editors_mode(datalayer, user):
    map = datalayer.map
    map.editors.add(user)
    map.save()
    datalayer.edit_status = DataLayer.EDITORS
    datalayer.save()
    assert datalayer.can_edit(user)


def test_anonymous_can_edit_in_public_mode(datalayer):
    datalayer.edit_status = DataLayer.ANONYMOUS
    datalayer.save()
    assert datalayer.can_edit()


def test_owner_can_edit_in_public_mode(datalayer, user):
    datalayer.edit_status = DataLayer.ANONYMOUS
    datalayer.save()
    assert datalayer.can_edit(datalayer.map.owner)


def test_editor_can_edit_in_public_mode(datalayer, user):
    map = datalayer.map
    map.editors.add(user)
    map.save()
    datalayer.edit_status = DataLayer.ANONYMOUS
    datalayer.save()
    assert datalayer.can_edit(user)


def test_anonymous_cannot_edit_in_anonymous_owner_mode(datalayer):
    datalayer.edit_status = DataLayer.OWNER
    datalayer.save()
    map = datalayer.map
    map.owner = None
    map.save()
    assert not datalayer.can_edit()


def test_anonymous_can_edit_in_anonymous_owner_but_public_mode(datalayer):
    datalayer.edit_status = DataLayer.ANONYMOUS
    datalayer.save()
    map = datalayer.map
    map.owner = None
    map.save()
    assert datalayer.can_edit()
