import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse

from umap.models import Map

from .base import MapFactory, UserFactory

User = get_user_model()

pytestmark = pytest.mark.django_db


def test_user_dashboard_is_restricted_to_logged_in(client):
    response = client.get(reverse("user_dashboard"))
    assert response.status_code == 302
    assert response["Location"] == "/en/login/?next=/en/me"


def test_user_dashboard_display_user_maps(client, map):
    client.login(username=map.owner.username, password="123123")
    response = client.get(reverse("user_dashboard"))
    assert response.status_code == 200
    body = response.content.decode()
    assert map.name in body
    assert f"{map.get_absolute_url()}?edit" in body
    assert f"{map.get_absolute_url()}?share" in body
    assert f"/map/{map.pk}/download" in body
    assert "Everyone (public)" in body
    assert "Owner only" in body


def test_user_dashboard_do_not_display_blocked_user_maps(client, map):
    map.share_status = Map.BLOCKED
    map.save()
    client.login(username=map.owner.username, password="123123")
    response = client.get(reverse("user_dashboard"))
    assert response.status_code == 200
    body = response.content.decode()
    assert map.name not in body


def test_user_dashboard_do_not_display_deleted_user_maps(client, map):
    map.share_status = Map.DELETED
    map.save()
    client.login(username=map.owner.username, password="123123")
    response = client.get(reverse("user_dashboard"))
    assert response.status_code == 200
    body = response.content.decode()
    assert map.name not in body


@pytest.mark.parametrize("share_status", [Map.DRAFT, Map.PRIVATE, Map.PUBLIC, Map.OPEN])
def test_user_dashboard_display_user_team_maps(client, map, team, user, share_status):
    user.teams.add(team)
    user.save()
    map.team = team
    map.share_status = share_status
    map.save()
    assert map.owner != user
    client.login(username=user.username, password="123123")
    response = client.get(reverse("user_dashboard"))
    assert response.status_code == 200
    body = response.content.decode()
    assert map.name in body
    assert map.get_absolute_url() in body


def test_user_dashboard_display_user_maps_distinct(client, map):
    # cf https://github.com/umap-project/umap/issues/1325
    anonymap = MapFactory(name="Map witout owner should not appear")
    user1 = UserFactory(username="user1")
    user2 = UserFactory(username="user2")
    map.editors.add(user1)
    map.editors.add(user2)
    map.save()
    client.login(username=map.owner.username, password="123123")
    response = client.get(reverse("user_dashboard"))
    assert response.status_code == 200
    body = response.content.decode()
    assert body.count(f'<a href="/en/map/test-map_{map.pk}">test map</a>') == 1
    assert body.count(anonymap.name) == 0


def test_user_dashboard_search(client, map):
    new_map = MapFactory(name="A map about bicycle", owner=map.owner)
    client.login(username=map.owner.username, password="123123")
    response = client.get(f"{reverse('user_dashboard')}?q=bicycle")
    assert response.status_code == 200
    body = response.content.decode()
    assert map.name not in body
    assert new_map.name in body


def test_user_dashboard_search_empty(client, map):
    client.login(username=map.owner.username, password="123123")
    response = client.get(f"{reverse('user_dashboard')}?q=car")
    assert response.status_code == 200
    body = response.content.decode()
    assert map.name not in body
    assert "No map found." in body
