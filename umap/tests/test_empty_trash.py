from datetime import datetime, timedelta
from unittest import mock

import pytest
from django.core.management import call_command

from umap.models import Map

from .base import MapFactory

pytestmark = pytest.mark.django_db


def test_empty_trash(user):
    recent = MapFactory(owner=user)
    recent_deleted = MapFactory(owner=user)
    recent_deleted.move_to_trash()
    recent_deleted.save()
    with mock.patch("django.utils.timezone.now") as mocked:
        mocked.return_value = datetime.utcnow() - timedelta(days=8)
        old_deleted = MapFactory(owner=user)
        old_deleted.move_to_trash()
        old_deleted.save()
        old = MapFactory(owner=user)
    assert Map.objects.count() == 4
    call_command("empty_trash", "--days=7", "--dry-run")
    assert Map.objects.count() == 4
    call_command("empty_trash", "--days=9")
    assert Map.objects.count() == 4
    call_command("empty_trash", "--days=7")
    assert not Map.objects.filter(pk=old_deleted.pk)
    assert Map.objects.filter(pk=old.pk)
    assert Map.objects.filter(pk=recent.pk)
    assert Map.objects.filter(pk=recent_deleted.pk)
