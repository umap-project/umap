import pytest
from django.urls import reverse

from umap.models import Map, Team

pytestmark = pytest.mark.django_db


def test_can_see_team_maps(client, map, team):
    map.team = team
    map.save()
    url = reverse("team_maps", args=(team.pk,))
    response = client.get(url)
    assert response.status_code == 200
    assert map.name in response.content.decode()


@pytest.mark.parametrize("share_status", [Map.PRIVATE, Map.DRAFT])
def test_others_cannot_see_team_private_maps_in_team_page(
    client, map, team, user, share_status
):
    map.team = team
    map.share_status = share_status
    map.save()
    url = reverse("team_maps", args=(team.pk,))
    response = client.get(url)
    assert response.status_code == 200
    assert map.name not in response.content.decode()
    # User is not in team
    client.login(username=user.username, password="123123")
    response = client.get(url)
    assert response.status_code == 200
    assert map.name not in response.content.decode()


@pytest.mark.parametrize("share_status", [Map.PRIVATE, Map.DRAFT])
def test_members_can_see_private_maps_in_team_page(
    client, map, team, user, share_status
):
    map.team = team
    map.share_status = share_status
    map.save()
    user.teams.add(team)
    user.save()
    url = reverse("team_maps", args=(team.pk,))
    client.login(username=user.username, password="123123")
    response = client.get(url)
    assert response.status_code == 200
    assert map.name in response.content.decode()


def test_user_can_see_their_teams(client, team, user):
    user.teams.add(team)
    user.save()
    url = reverse("user_teams")
    client.login(username=user.username, password="123123")
    response = client.get(url)
    assert response.status_code == 200
    assert team.name in response.content.decode()


def test_can_create_a_team(client, user):
    assert not Team.objects.count()
    url = reverse("team_new")
    client.login(username=user.username, password="123123")
    response = client.post(url, {"name": "my new team", "members": [user.pk]})
    assert response.status_code == 302
    assert response["Location"] == "/en/me/teams"
    assert Team.objects.count() == 1
    team = Team.objects.first()
    assert team.name == "my new team"
    assert team in user.teams.all()


def test_can_edit_a_team_name(client, user, team):
    user.teams.add(team)
    user.save()
    assert Team.objects.count() == 1
    url = reverse("team_update", args=(team.pk,))
    client.login(username=user.username, password="123123")
    response = client.post(url, {"name": "my new team", "members": [user.pk]})
    assert response.status_code == 302
    assert response["Location"] == "/en/me/teams"
    assert Team.objects.count() == 1
    modified = Team.objects.first()
    assert modified.name == "my new team"
    assert modified in user.teams.all()


def test_can_add_user_to_team(client, user, user2, team):
    user.teams.add(team)
    user.save()
    assert Team.objects.count() == 1
    url = reverse("team_update", args=(team.pk,))
    client.login(username=user.username, password="123123")
    response = client.post(url, {"name": team.name, "members": [user.pk, user2.pk]})
    assert response.status_code == 302
    assert response["Location"] == "/en/me/teams"
    assert Team.objects.count() == 1
    modified = Team.objects.first()
    assert user in modified.users.all()
    assert user2 in modified.users.all()


def test_can_remove_user_from_team(client, user, user2, team):
    user.teams.add(team)
    user.save()
    user2.teams.add(team)
    user2.save()
    assert Team.objects.count() == 1
    url = reverse("team_update", args=(team.pk,))
    client.login(username=user.username, password="123123")
    response = client.post(url, {"name": team.name, "members": [user.pk]})
    assert response.status_code == 302
    assert response["Location"] == "/en/me/teams"
    assert Team.objects.count() == 1
    modified = Team.objects.first()
    assert user in modified.users.all()
    assert user2 not in modified.users.all()


def test_cannot_edit_a_team_if_not_member(client, user, user2, team):
    user.teams.add(team)
    user.save()
    assert Team.objects.count() == 1
    url = reverse("team_update", args=(team.pk,))
    client.login(username=user2.username, password="456456")
    response = client.post(url, {"name": "my new team", "members": [user.pk]})
    assert response.status_code == 403


def test_can_delete_a_team(client, user, team):
    user.teams.add(team)
    user.save()
    assert Team.objects.count() == 1
    url = reverse("team_delete", args=(team.pk,))
    client.login(username=user.username, password="123123")
    response = client.post(url)
    assert response.status_code == 302
    assert response["Location"] == "/en/me/teams"
    assert Team.objects.count() == 0


def test_cannot_delete_a_team_if_not_member(client, user, user2, team):
    user.teams.add(team)
    user.save()
    assert Team.objects.count() == 1
    url = reverse("team_delete", args=(team.pk,))
    client.login(username=user2.username, password="456456")
    response = client.post(url)
    assert response.status_code == 403
    assert Team.objects.count() == 1


def test_cannot_delete_a_team_if_more_than_one_member(client, user, user2, team):
    user.teams.add(team)
    user.save()
    user2.teams.add(team)
    user2.save()
    assert Team.objects.count() == 1
    url = reverse("team_delete", args=(team.pk,))
    client.login(username=user.username, password="123123")
    response = client.post(url)
    assert response.status_code == 400
    assert Team.objects.count() == 1
