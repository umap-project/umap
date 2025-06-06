import pytest
from django.core.management import call_command

from umap.models import Map, Team

from .base import MapFactory

pytestmark = pytest.mark.django_db


def test_switch_user(user, user2, map, team):
    user_owned = MapFactory(owner=user)
    user2_owned = MapFactory(owner=user2)
    map.editors.add(user)
    map.save()
    team.users.add(user)
    team.save()
    call_command("switch_user", user.username, user2.username, "--dry-run")
    assert Map.objects.get(pk=user_owned.pk).owner == user
    assert Map.objects.get(pk=user2_owned.pk).owner == user2
    assert user in Map.objects.get(pk=map.pk).editors.all()
    assert user2 not in Map.objects.get(pk=map.pk).editors.all()
    assert user in Team.objects.get(pk=team.pk).users.all()
    assert user2 not in Team.objects.get(pk=team.pk).users.all()
    call_command("switch_user", user.username, user2.username)
    assert Map.objects.get(pk=user_owned.pk).owner == user2
    assert Map.objects.get(pk=user2_owned.pk).owner == user2
    assert user not in Map.objects.get(pk=map.pk).editors.all()
    assert user2 in Map.objects.get(pk=map.pk).editors.all()
    assert user not in Team.objects.get(pk=team.pk).users.all()
    assert user2 in Team.objects.get(pk=team.pk).users.all()
