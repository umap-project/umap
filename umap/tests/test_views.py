import json
import socket
from datetime import date, timedelta

import pytest
from django.conf import settings
from django.contrib.auth import get_user, get_user_model
from django.urls import reverse
from django.test import RequestFactory

from umap import VERSION
from umap.views import validate_url


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
    params = {"url": "http://example.org/a space is invalid"}
    headers = {
        "HTTP_X_REQUESTED_WITH": "XMLHttpRequest",
        "HTTP_REFERER": settings.SITE_URL,
    }
    response = client.get(url, params, **headers)
    assert response.status_code == 400


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
    User = get_user_model()
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
    map.owner.last_login = date.today()
    map.owner.save()
    user2.last_login = date.today() - timedelta(days=8)
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
    assert f"{map.get_absolute_url()}?download" in body
    assert "Everyone (public)" in body
    assert "Owner only" in body
