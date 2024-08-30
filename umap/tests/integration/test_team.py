import re

import pytest

from umap.models import Team

pytestmark = pytest.mark.django_db


def test_can_add_user_to_team(live_server, map, user, team, login):
    map.owner.teams.add(team)
    map.owner.save()
    assert Team.objects.count() == 1
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
    assert Team.objects.count() == 1
    modified = Team.objects.first()
    assert user in modified.users.all()


def test_can_remove_user_from_team(live_server, map, user, user2, team, login):
    map.owner.teams.add(team)
    map.owner.save()
    user.teams.add(team)
    user.save()
    user2.teams.add(team)
    user2.save()
    assert Team.objects.count() == 1
    page = login(map.owner)
    with page.expect_navigation():
        page.get_by_role("link", name="My teams").click()
    with page.expect_navigation():
        page.get_by_role("link", name="Edit").click()
    page.locator("li").filter(has_text="Averell").locator(".close").click()
    page.get_by_role("button", name="Save").click()
    assert Team.objects.count() == 1
    modified = Team.objects.first()
    assert user in modified.users.all()
    assert user2 not in modified.users.all()
