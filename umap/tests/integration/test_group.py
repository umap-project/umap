import re

import pytest
from django.contrib.auth.models import Group

pytestmark = pytest.mark.django_db


def test_can_add_user_to_group(live_server, map, user, group, login):
    map.owner.groups.add(group)
    map.owner.save()
    assert Group.objects.count() == 1
    page = login(map.owner)
    with page.expect_navigation():
        page.get_by_role("link", name="My teams").click()
    with page.expect_navigation():
        page.get_by_role("link", name="Edit").click()
    page.get_by_placeholder("Add user").click()
    with page.expect_response(re.compile(r".*/agnocomplete/.*")):
        page.get_by_placeholder("Add user").press_sequentially("joe")
    page.get_by_text("Joe").click()
    page.get_by_role("button", name="Save").click()
    assert Group.objects.count() == 1
    modified = Group.objects.first()
    assert user in modified.user_set.all()


def test_can_remove_user_from_group(live_server, map, user, user2, group, login):
    map.owner.groups.add(group)
    map.owner.save()
    user.groups.add(group)
    user.save()
    user2.groups.add(group)
    user2.save()
    assert Group.objects.count() == 1
    page = login(map.owner)
    with page.expect_navigation():
        page.get_by_role("link", name="My teams").click()
    with page.expect_navigation():
        page.get_by_role("link", name="Edit").click()
    page.locator("li").filter(has_text="Averell").locator(".close").click()
    page.get_by_role("button", name="Save").click()
    assert Group.objects.count() == 1
    modified = Group.objects.first()
    assert user in modified.user_set.all()
    assert user2 not in modified.user_set.all()
