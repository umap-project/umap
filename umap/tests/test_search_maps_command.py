import pytest
from django.core.management import call_command

from umap.models import Map

from .base import MapFactory

pytestmark = pytest.mark.django_db


def test_search_and_delete_maps(map):
    target = MapFactory(name="find me")
    assert Map.objects.filter(share_status=Map.DELETED).count() == 0

    call_command("search_maps", "find", "--delete", "--dry-run", "--no-input")
    assert Map.objects.filter(share_status=Map.DELETED).count() == 0

    call_command("search_maps", "find", "--delete", "--no-input")
    assert Map.objects.filter(share_status=Map.DELETED).count() == 1

    assert not Map.public.filter(pk=target.pk)

    call_command("search_maps", "find", "--restore", "--no-input")
    assert Map.objects.filter(share_status=Map.DELETED).count() == 0

    assert Map.objects.get(pk=target.pk).share_status == Map.DRAFT


def test_search_and_block_maps(map):
    target = MapFactory(name="find me")
    assert Map.objects.filter(share_status=Map.BLOCKED).count() == 0

    call_command("search_maps", "find", "--block", "--dry-run", "--no-input")
    assert Map.objects.filter(share_status=Map.BLOCKED).count() == 0

    call_command("search_maps", "find", "--block", "--no-input")
    assert Map.objects.filter(share_status=Map.BLOCKED).count() == 1

    assert not Map.public.filter(pk=target.pk)

    call_command("search_maps", "find", "--restore", "--no-input")
    assert Map.objects.filter(share_status=Map.BLOCKED).count() == 0

    assert Map.objects.get(pk=target.pk).share_status == Map.DRAFT


def test_search_map_by_user(map, user):
    map.share_status = Map.DELETED
    map.save()
    target = MapFactory(name="find me", share_status=Map.DELETED, owner=user)
    public = MapFactory(name="find me", share_status=Map.PUBLIC, owner=user)
    assert Map.objects.filter(share_status=Map.DELETED).count() == 2

    call_command(
        "search_maps", "--user", user.username, "--no-input", "--deleted", "--restore"
    )
    assert Map.objects.filter(share_status=Map.DELETED).count() == 1

    assert Map.objects.get(pk=target.pk).share_status == Map.DRAFT
    assert Map.objects.get(pk=public.pk).share_status == Map.PUBLIC


def test_search_map_by_id(map, user):
    map.share_status = Map.DELETED
    map.save()
    target = MapFactory(name="find me", share_status=Map.DELETED, owner=user)
    public = MapFactory(name="find me", share_status=Map.PUBLIC, owner=user)
    assert Map.objects.filter(share_status=Map.DELETED).count() == 2

    call_command(
        "search_maps", "--id", target.pk, "--no-input", "--deleted", "--restore"
    )
    assert Map.objects.filter(share_status=Map.DELETED).count() == 1

    assert Map.objects.get(pk=target.pk).share_status == Map.DRAFT
    assert Map.objects.get(pk=public.pk).share_status == Map.PUBLIC
