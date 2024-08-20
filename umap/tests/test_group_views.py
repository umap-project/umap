import pytest
from django.urls import reverse
from django.contrib.auth.models import Group

pytestmark = pytest.mark.django_db


def test_can_see_group_maps(client, map, group):
    map.group = group
    map.save()
    url = reverse("group_maps", args=(group.pk,))
    response = client.get(url)
    assert response.status_code == 200
    assert map.name in response.content.decode()


def test_user_can_see_their_groups(client, group, user):
    user.groups.add(group)
    user.save()
    url = reverse("user_groups")
    client.login(username=user.username, password="123123")
    response = client.get(url)
    assert response.status_code == 200
    assert group.name in response.content.decode()


def test_can_create_a_group(client, user):
    assert not Group.objects.count()
    url = reverse("group_new")
    client.login(username=user.username, password="123123")
    response = client.post(url, {"name": "my new group", "members": [user.pk]})
    assert response.status_code == 302
    assert response["Location"] == "/en/me/groups"
    assert Group.objects.count() == 1
    group = Group.objects.first()
    assert group.name == "my new group"
    assert group in user.groups.all()


def test_can_edit_a_group(client, user, group):
    user.groups.add(group)
    user.save()
    assert Group.objects.count() == 1
    url = reverse("group_update", args=(group.pk,))
    client.login(username=user.username, password="123123")
    response = client.post(url, {"name": "my new group", "members": [user.pk]})
    assert response.status_code == 302
    assert response["Location"] == "/en/me/groups"
    assert Group.objects.count() == 1
    modified = Group.objects.first()
    assert modified.name == "my new group"
    assert modified in user.groups.all()


def test_cannot_edit_a_group_if_not_member(client, user, user2, group):
    user.groups.add(group)
    user.save()
    assert Group.objects.count() == 1
    url = reverse("group_update", args=(group.pk,))
    client.login(username=user2.username, password="123123")
    response = client.post(url, {"name": "my new group", "members": [user.pk]})
    assert response.status_code == 403


def test_can_delete_a_group(client, user, group):
    user.groups.add(group)
    user.save()
    assert Group.objects.count() == 1
    url = reverse("group_delete", args=(group.pk,))
    client.login(username=user.username, password="123123")
    response = client.post(url)
    assert response.status_code == 302
    assert response["Location"] == "/en/me/groups"
    assert Group.objects.count() == 0


def test_cannot_delete_a_group_if_not_member(client, user, user2, group):
    user.groups.add(group)
    user.save()
    assert Group.objects.count() == 1
    url = reverse("group_delete", args=(group.pk,))
    client.login(username=user2.username, password="123123")
    response = client.post(url)
    assert response.status_code == 403
    assert Group.objects.count() == 1


def test_cannot_delete_a_group_if_more_than_one_member(client, user, user2, group):
    user.groups.add(group)
    user.save()
    user2.groups.add(group)
    user2.save()
    assert Group.objects.count() == 1
    url = reverse("group_delete", args=(group.pk,))
    client.login(username=user.username, password="123123")
    response = client.post(url)
    assert response.status_code == 400
    assert Group.objects.count() == 1
