import json
import socket
from datetime import datetime, timedelta

import pytest
from django.conf import settings
from django.contrib.auth import get_user, get_user_model
from django.core.signing import TimestampSigner
from django.test import RequestFactory
from django.urls import reverse
from django.utils.timezone import make_aware

from umap import VERSION
from umap.models import Map, Star
from umap.views import validate_url

from .base import MapFactory, UserFactory

User = get_user_model()


def get(target="http://osm.org/georss.xml", verb="get", **kwargs):
    defaults = {
        "HTTP_X_REQUESTED_WITH": "XMLHttpRequest",
        "HTTP_REFERER": "%s/path/" % settings.SITE_URL,
    }
    defaults.update(kwargs)
    func = getattr(RequestFactory(**defaults), verb)
    return func("/", {"url": target})


def test_good_request_passes():
    target = "http://osm.org/georss.xml"
    request = get(target)
    url = validate_url(request)
    assert url == target


def test_no_url_raises():
    request = get("")
    with pytest.raises(AssertionError):
        validate_url(request)


def test_relative_url_raises():
    request = get("/just/a/path/")
    with pytest.raises(AssertionError):
        validate_url(request)


def test_file_uri_raises():
    request = get("file:///etc/passwd")
    with pytest.raises(AssertionError):
        validate_url(request)


def test_localhost_raises():
    request = get("http://localhost/path/")
    with pytest.raises(AssertionError):
        validate_url(request)


def test_local_IP_raises():
    url = "http://{}/path/".format(socket.gethostname())
    request = get(url)
    with pytest.raises(AssertionError):
        validate_url(request)


def test_POST_raises():
    request = get(verb="post")
    with pytest.raises(AssertionError):
        validate_url(request)


def test_unkown_domain_raises():
    request = get("http://xlkjdkjsdlkjfd.com")
    with pytest.raises(AssertionError):
        validate_url(request)


def test_valid_proxy_request(client):
    url = reverse("ajax-proxy")
    params = {"url": "http://example.org"}
    headers = {
        "HTTP_X_REQUESTED_WITH": "XMLHttpRequest",
        "HTTP_REFERER": settings.SITE_URL,
    }
    response = client.get(url, params, **headers)
    assert response.status_code == 200
    assert "Example Domain" in response.content.decode()
    assert "Cookie" not in response["Vary"]


def test_valid_proxy_request_with_ttl(client):
    url = reverse("ajax-proxy")
    params = {"url": "http://example.org", "ttl": 3600}
    headers = {
        "HTTP_X_REQUESTED_WITH": "XMLHttpRequest",
        "HTTP_REFERER": settings.SITE_URL,
    }
    response = client.get(url, params, **headers)
    assert response.status_code == 200
    assert "Example Domain" in response.content.decode()
    assert "Cookie" not in response["Vary"]
    assert response["X-Accel-Expires"] == "3600"


def test_valid_proxy_request_with_invalid_ttl(client):
    url = reverse("ajax-proxy")
    params = {"url": "http://example.org", "ttl": "invalid"}
    headers = {
        "HTTP_X_REQUESTED_WITH": "XMLHttpRequest",
        "HTTP_REFERER": settings.SITE_URL,
    }
    response = client.get(url, params, **headers)
    assert response.status_code == 200
    assert "Example Domain" in response.content.decode()
    assert "Cookie" not in response["Vary"]
    assert "X-Accel-Expires" not in response


def test_invalid_proxy_url_should_return_400(client):
    url = reverse("ajax-proxy")
    params = {"url": "http://example.org/a\ncarriage\r\nreturn is invalid"}
    headers = {
        "HTTP_X_REQUESTED_WITH": "XMLHttpRequest",
        "HTTP_REFERER": settings.SITE_URL,
    }
    response = client.get(url, params, **headers)
    assert response.status_code == 400


def test_valid_proxy_request_with_x_accel_redirect(client, settings):
    settings.UMAP_XSENDFILE_HEADER = "X-Accel-Redirect"
    url = reverse("ajax-proxy")
    params = {"url": "http://example.org?foo=bar&bar=foo", "ttl": 300}
    headers = {
        "HTTP_X_REQUESTED_WITH": "XMLHttpRequest",
        "HTTP_REFERER": settings.SITE_URL,
    }
    response = client.get(url, params, **headers)
    assert response.status_code == 200
    assert "X-Accel-Redirect" in response.headers
    assert (
        response["X-Accel-Redirect"]
        == "/proxy/http%3A%2F%2Fexample.org%3Ffoo%3Dbar%26bar%3Dfoo"
    )
    assert "X-Accel-Expires" in response.headers
    assert response["X-Accel-Expires"] == "300"


@pytest.mark.django_db
def test_login_does_not_contain_form_if_not_enabled(client, settings):
    settings.ENABLE_ACCOUNT_LOGIN = False
    response = client.get(reverse("login"))
    assert "username" not in response.content.decode()


@pytest.mark.django_db
def test_login_contains_form_if_enabled(client, settings):
    settings.ENABLE_ACCOUNT_LOGIN = True
    response = client.get(reverse("login"))
    assert "username" in response.content.decode()


@pytest.mark.django_db
def test_can_login_with_username_and_password_if_enabled(client, settings):
    settings.ENABLE_ACCOUNT_LOGIN = True
    user = User.objects.create(username="test")
    user.set_password("test")
    user.save()
    client.post(reverse("login"), {"username": "test", "password": "test"})
    user = get_user(client)
    assert user.is_authenticated


@pytest.mark.django_db
def test_stats_empty(client):
    response = client.get(reverse("stats"))
    assert json.loads(response.content.decode()) == {
        "maps_active_last_week_count": 0,
        "maps_count": 0,
        "users_active_last_week_count": 0,
        "users_count": 0,
        "version": VERSION,
    }


@pytest.mark.django_db
def test_stats_basic(client, map, datalayer, user2):
    map.owner.last_login = make_aware(datetime.now())
    map.owner.save()
    user2.last_login = make_aware(datetime.now()) - timedelta(days=8)
    user2.save()
    response = client.get(reverse("stats"))
    assert json.loads(response.content.decode()) == {
        "maps_active_last_week_count": 1,
        "maps_count": 1,
        "users_active_last_week_count": 1,
        "users_count": 2,
        "version": VERSION,
    }


@pytest.mark.django_db
def test_read_only_displays_message_if_enabled(client, settings):
    settings.UMAP_READONLY = True
    response = client.get(reverse("home"))
    assert (
        "This instance of uMap is currently in read only mode"
        in response.content.decode()
    )


@pytest.mark.django_db
def test_read_only_does_not_display_message_if_disabled(client, settings):
    settings.UMAP_READONLY = False
    response = client.get(reverse("home"))
    assert (
        "This instance of uMap is currently in read only mode"
        not in response.content.decode()
    )


@pytest.mark.django_db
def test_read_only_hides_create_buttons_if_enabled(client, settings):
    settings.UMAP_READONLY = True
    response = client.get(reverse("home"))
    assert "Create a map" not in response.content.decode()


@pytest.mark.django_db
def test_read_only_shows_create_buttons_if_disabled(client, settings):
    settings.UMAP_READONLY = False
    response = client.get(reverse("home"))
    assert "Create a map" in response.content.decode()


@pytest.mark.django_db
def test_change_user_display_name(client, user, settings):
    username = "MyUserFooName"
    first_name = "Ezekiel"
    user.username = username
    user.first_name = first_name
    user.save()
    client.login(username=username, password="123123")
    response = client.get(reverse("home"))
    assert username in response.content.decode()
    assert first_name not in response.content.decode()
    settings.USER_DISPLAY_NAME = "{first_name}"
    response = client.get(reverse("home"))
    assert first_name in response.content.decode()
    # username will still be in the contant as it's in the "my maps" URL path.


@pytest.mark.django_db
def test_change_user_slug(client, user, settings):
    username = "MyUserFooName"
    user.username = username
    user.save()
    client.login(username=username, password="123123")
    response = client.get(reverse("home"))
    assert f"/en/user/{username}/" in response.content.decode()
    settings.USER_URL_FIELD = "pk"
    response = client.get(reverse("home"))
    assert f"/en/user/{user.pk}/" in response.content.decode()


@pytest.mark.django_db
def test_user_dashboard_is_restricted_to_logged_in(client):
    response = client.get(reverse("user_dashboard"))
    assert response.status_code == 302
    assert response["Location"] == "/en/login/?next=/en/me"


@pytest.mark.django_db
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


@pytest.mark.django_db
def test_user_dashboard_display_user_team_maps(client, map, team, user):
    user.teams.add(team)
    user.save()
    map.team = team
    map.save()
    client.login(username=user.username, password="123123")
    response = client.get(reverse("user_dashboard"))
    assert response.status_code == 200
    body = response.content.decode()
    assert map.name in body
    assert map.get_absolute_url() in body


@pytest.mark.django_db
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


@pytest.mark.django_db
def test_logout_should_return_redirect(client, user, settings):
    client.login(username=user.username, password="123123")
    response = client.get(reverse("logout"))
    assert response.status_code == 302
    assert response["Location"] == "/"


@pytest.mark.django_db
def test_user_profile_is_restricted_to_logged_in(client):
    response = client.get(reverse("user_profile"))
    assert response.status_code == 302
    assert response["Location"] == "/en/login/?next=/en/me/profile"


@pytest.mark.django_db
def test_user_profile_allows_to_edit_username(client, map):
    client.login(username=map.owner.username, password="123123")
    new_name = "newname"
    response = client.post(
        reverse("user_profile"), data={"username": new_name}, follow=True
    )
    assert response.status_code == 200
    user = User.objects.get(pk=map.owner.pk)
    assert user.username == new_name


@pytest.mark.django_db
def test_user_profile_cannot_set_to_existing_username(client, map, user2):
    client.login(username=map.owner.username, password="123123")
    response = client.post(
        reverse("user_profile"), data={"username": user2.username}, follow=True
    )
    assert response.status_code == 200
    user = User.objects.get(pk=map.owner.pk)
    assert user.username == map.owner.username
    assert user.username != user2.username


@pytest.mark.django_db
def test_user_profile_does_not_allow_to_edit_other_fields(client, map):
    client.login(username=map.owner.username, password="123123")
    new_email = "foo@bar.com"
    response = client.post(
        reverse("user_profile"),
        data={"username": new_email, "is_superuser": True},
        follow=True,
    )
    assert response.status_code == 200
    user = User.objects.get(pk=map.owner.pk)
    assert user.email != new_email
    assert user.is_superuser is False


def test_favicon_redirection(client):
    response = client.get("/favicon.ico")
    assert response.status_code == 302
    assert response.url == "/static/umap/favicons/favicon.ico"


def test_webmanifest(client):
    response = client.get("/manifest.webmanifest")
    assert response.status_code == 200
    assert response["content-type"] == "application/json"
    assert response.json() == {
        "icons": [
            {
                "sizes": "192x192",
                "src": "/static/umap/favicons/icon-192.png",
                "type": "image/png",
            },
            {
                "sizes": "512x512",
                "src": "/static/umap/favicons/icon-512.png",
                "type": "image/png",
            },
        ]
    }


@pytest.mark.django_db
def test_home_feed(client, settings, user, tilelayer):
    settings.UMAP_HOME_FEED = "latest"
    staff = UserFactory(username="Staff", is_staff=True)
    starred = MapFactory(
        owner=user, name="A public map starred by staff", share_status=Map.PUBLIC
    )
    MapFactory(
        owner=user, name="A public map not starred by staff", share_status=Map.PUBLIC
    )
    non_staff = MapFactory(
        owner=user, name="A public map starred by non staff", share_status=Map.PUBLIC
    )
    private = MapFactory(
        owner=user, name="A private map starred by staff", share_status=Map.PRIVATE
    )
    reserved = MapFactory(
        owner=user, name="A reserved map starred by staff", share_status=Map.OPEN
    )
    Star.objects.create(by=staff, map=starred)
    Star.objects.create(by=staff, map=private)
    Star.objects.create(by=staff, map=reserved)
    Star.objects.create(by=user, map=non_staff)
    response = client.get(reverse("home"))
    content = response.content.decode()
    assert "A public map starred by staff" in content
    assert "A public map not starred by staff" in content
    assert "A public map starred by non staff" in content
    assert "A private map starred by staff" not in content
    assert "A reserved map starred by staff" not in content
    settings.UMAP_HOME_FEED = "highlighted"
    response = client.get(reverse("home"))
    content = response.content.decode()
    assert "A public map starred by staff" in content
    assert "A public map not starred by staff" not in content
    assert "A public map starred by non staff" not in content
    assert "A private map starred by staff" not in content
    assert "A reserved map starred by staff" not in content
    settings.UMAP_HOME_FEED = None
    response = client.get(reverse("home"))
    content = response.content.decode()
    assert "A public map starred by staff" not in content
    assert "A public map not starred by staff" not in content
    assert "A public map starred by non staff" not in content
    assert "A private map starred by staff" not in content
    assert "A reserved map starred by staff" not in content


@pytest.mark.django_db
def test_websocket_token_returns_login_required_if_not_connected(client, user, map):
    token_url = reverse("map_websocket_auth_token", kwargs={"map_id": map.id})
    resp = client.get(token_url)
    assert "login_required" in resp.json()


@pytest.mark.django_db
def test_websocket_token_returns_403_if_unauthorized(client, user, user2, map):
    client.login(username=map.owner.username, password="123123")
    map.owner = user2
    map.save()

    token_url = reverse("map_websocket_auth_token", kwargs={"map_id": map.id})
    resp = client.get(token_url)
    assert resp.status_code == 403


@pytest.mark.django_db
def test_websocket_token_is_generated_for_anonymous(client, user, user2, map):
    map.edit_status = Map.ANONYMOUS
    map.save()

    token_url = reverse("map_websocket_auth_token", kwargs={"map_id": map.id})
    resp = client.get(token_url)
    token = resp.json().get("token")
    assert TimestampSigner().unsign_object(token, max_age=30)


@pytest.mark.django_db
def test_websocket_token_returns_a_valid_token_when_authorized(client, user, map):
    client.login(username=map.owner.username, password="123123")
    token_url = reverse("map_websocket_auth_token", kwargs={"map_id": map.id})
    resp = client.get(token_url)
    assert resp.status_code == 200
    token = resp.json().get("token")
    assert TimestampSigner().unsign_object(token, max_age=30)


@pytest.mark.django_db
def test_websocket_token_is_generated_for_editors(client, user, user2, map):
    map.edit_status = Map.COLLABORATORS
    map.editors.add(user2)
    map.save()

    assert client.login(username=user2.username, password="456456")
    token_url = reverse("map_websocket_auth_token", kwargs={"map_id": map.id})
    resp = client.get(token_url)
    token = resp.json().get("token")
    assert TimestampSigner().unsign_object(token, max_age=30)
