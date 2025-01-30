from datetime import datetime, timedelta
from unittest import mock

import pytest
from django.core.management import call_command

from umap.models import DataLayer, Map

from .base import DataLayerFactory, MapFactory

pytestmark = pytest.mark.django_db


def test_empty_trash(user):
    recent = MapFactory(owner=user)
    recent_layer = DataLayerFactory(map=recent)
    deleted_layer = DataLayerFactory(map=recent)
    recent_deleted = MapFactory(owner=user)
    recent_deleted.move_to_trash()
    recent_deleted.save()
    with mock.patch("django.utils.timezone.now") as mocked:
        mocked.return_value = datetime.utcnow() - timedelta(days=8)
        old_deleted = MapFactory(owner=user)
        old_deleted.move_to_trash()
        deleted_layer.move_to_trash()
        old = MapFactory(owner=user)
    assert Map.objects.count() == 4
    assert DataLayer.objects.count() == 2
    call_command("empty_trash", "--days=7", "--dry-run")
    assert Map.objects.count() == 4
    assert DataLayer.objects.count() == 2
    call_command("empty_trash", "--days=9")
    assert Map.objects.count() == 4
    assert DataLayer.objects.count() == 2
    call_command("empty_trash", "--days=7")
    assert not Map.objects.filter(pk=old_deleted.pk)
    assert Map.objects.filter(pk=old.pk)
    assert Map.objects.filter(pk=recent.pk)
    assert Map.objects.filter(pk=recent_deleted.pk)
    assert not DataLayer.objects.filter(pk=deleted_layer.pk)
    assert DataLayer.objects.filter(pk=recent_layer.pk)
