import os
from pathlib import Path

import pytest
from django.core.files.base import ContentFile

from umap.models import DataLayer, Map

from .base import DataLayerFactory, MapFactory

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


def test_should_remove_old_versions_on_save(map, settings):
    datalayer = DataLayerFactory(uuid="0f1161c0-c07f-4ba4-86c5-8d8981d8a813", old_id=17)
    settings.UMAP_KEEP_VERSIONS = 3
    root = Path(datalayer.storage_root())
    before = len(datalayer.geojson.storage.listdir(root)[1])
    newer = f"{datalayer.pk}_1440924889.geojson"
    medium = f"{datalayer.pk}_1440923687.geojson"
    older = f"{datalayer.pk}_1440918637.geojson"
    with_old_id = f"{datalayer.old_id}_1440918537.geojson"
    other = "123456_1440918637.geojson"
    for path in [medium, newer, older, with_old_id, other]:
        datalayer.geojson.storage.save(root / path, ContentFile("{}"))
        datalayer.geojson.storage.save(root / f"{path}.gz", ContentFile("{}"))
    assert len(datalayer.geojson.storage.listdir(root)[1]) == 10 + before
    files = datalayer.geojson.storage.listdir(root)[1]
    # Those files should be present before save, which will purge them
    assert older in files
    assert older + ".gz" in files
    assert with_old_id in files
    assert with_old_id + ".gz" in files
    datalayer.save()
    files = datalayer.geojson.storage.listdir(root)[1]
    # Flat + gz files, but not latest gz, which is created at first datalayer read.
    # older and with_old_id should have been removed
    assert len(files) == 5
    assert newer in files
    assert medium in files
    assert Path(datalayer.geojson.path).name in files
    # File from another datalayer, purge should have impacted it.
    assert other in files
    assert other + ".gz" in files
    assert older not in files
    assert older + ".gz" not in files
    assert with_old_id not in files
    assert with_old_id + ".gz" not in files
    names = [v["name"] for v in datalayer.versions]
    assert names == [Path(datalayer.geojson.name).name, newer, medium]


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


def test_owner_can_edit_in_inherit_mode_and_map_in_owner_mode(datalayer):
    datalayer.edit_status = DataLayer.INHERIT
    datalayer.save()
    map = datalayer.map
    map.edit_status = Map.OWNER
    map.save()
    assert datalayer.can_edit(map.owner)


def test_editors_cannot_edit_in_inherit_mode_and_map_in_owner_mode(datalayer, user):
    datalayer.edit_status = DataLayer.INHERIT
    datalayer.save()
    map = datalayer.map
    map.editors.add(user)
    map.edit_status = Map.OWNER
    map.save()
    assert not datalayer.can_edit(user)


def test_anonymous_cannot_edit_in_inherit_mode_and_map_in_owner_mode(datalayer):
    datalayer.edit_status = DataLayer.INHERIT
    datalayer.save()
    map = datalayer.map
    map.edit_status = Map.OWNER
    map.save()
    assert not datalayer.can_edit()


def test_owner_can_edit_in_inherit_mode_and_map_in_editors_mode(datalayer):
    datalayer.edit_status = DataLayer.INHERIT
    datalayer.save()
    map = datalayer.map
    map.edit_status = Map.EDITORS
    map.save()
    assert datalayer.can_edit(map.owner)


def test_editors_can_edit_in_inherit_mode_and_map_in_editors_mode(datalayer, user):
    datalayer.edit_status = DataLayer.INHERIT
    datalayer.save()
    map = datalayer.map
    map.editors.add(user)
    map.edit_status = Map.EDITORS
    map.save()
    assert datalayer.can_edit(user)


def test_anonymous_cannot_edit_in_inherit_mode_and_map_in_editors_mode(datalayer):
    datalayer.edit_status = DataLayer.INHERIT
    datalayer.save()
    map = datalayer.map
    map.edit_status = Map.EDITORS
    map.save()
    assert not datalayer.can_edit()


def test_anonymous_can_edit_in_inherit_mode_and_map_in_public_mode(datalayer):
    datalayer.edit_status = DataLayer.INHERIT
    datalayer.save()
    map = datalayer.map
    map.edit_status = Map.ANONYMOUS
    map.save()
    assert datalayer.can_edit()
