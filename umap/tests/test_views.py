import hashlib
import json
import os
import time
from datetime import datetime, timedelta

import httpx
import pytest
from django.conf import settings
from django.contrib.auth import get_user, get_user_model
from django.core.signing import TimestampSigner
from django.urls import reverse
from django.utils.timezone import make_aware

from umap import VERSION
from umap.models import Map, Star

from .base import MapFactory, UserFactory

User = get_user_model()


@pytest.fixture
def proxy_cache_dir(settings, tmp_path):
    settings.AJAX_PROXY_CACHE_DIR = str(tmp_path)
    return tmp_path


@pytest.fixture
def proxy_headers():
    return {
        "X-Requested-With": "XMLHttpRequest",
        "Referer": settings.SITE_URL,
    }


@pytest.fixture
def httpx_handler(monkeypatch):
    """Route AjaxProxy's httpx calls through a MockTransport.

    Reassign `transport.handler` from a test to control the upstream response.
    """

    def default_handler(request):
        return httpx.Response(
            200, content=b"OK", headers={"content-type": "text/plain"}
        )

    transport = httpx.MockTransport(default_handler)
    real_async_client = httpx.AsyncClient

    def fake_async_client(*args, **kwargs):
        kwargs["transport"] = transport
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr("umap.views.httpx.AsyncClient", fake_async_client)
    return transport


def proxy_url(ttl=300):
    return reverse("ajax-proxy", kwargs={"ttl": ttl})


def _cache_basename(url):
    return f"umap_{hashlib.sha256(url.encode()).hexdigest()}"


async def test_valid_proxy_request(async_client, proxy_cache_dir, proxy_headers):
    response = await async_client.get(
        proxy_url(), {"url": "http://example.org"}, headers=proxy_headers
    )
    assert response.status_code == 200
    assert b"Example Domain" in b"".join(response.streaming_content)
    assert "Cookie" not in response.get("Vary", "")


async def test_valid_proxy_request_with_ttl(
    async_client, proxy_cache_dir, proxy_headers
):
    response = await async_client.get(
        proxy_url(3600), {"url": "http://example.org"}, headers=proxy_headers
    )
    assert response.status_code == 200
    assert b"Example Domain" in b"".join(response.streaming_content)


async def test_invalid_ttl_is_coerced_to_default(
    async_client, proxy_cache_dir, proxy_headers, httpx_handler
):
    # ensure_ttl coerces any int outside the allowed set to the default 300.
    response = await async_client.get(
        proxy_url(999), {"url": "http://example.org"}, headers=proxy_headers
    )
    assert response.status_code == 200


async def test_invalid_proxy_url_should_return_400(
    async_client, proxy_cache_dir, proxy_headers
):
    response = await async_client.get(
        proxy_url(),
        {"url": "http://example.org/a\ncarriage\r\nreturn is invalid"},
        headers=proxy_headers,
    )
    assert response.status_code == 400


async def test_proxy_caches_response(
    async_client, proxy_cache_dir, proxy_headers, httpx_handler
):
    calls = []

    def handler(request):
        calls.append(str(request.url))
        return httpx.Response(
            200, content=b"hello", headers={"content-type": "text/plain"}
        )

    httpx_handler.handler = handler

    r1 = await async_client.get(
        proxy_url(), {"url": "http://example.org"}, headers=proxy_headers
    )
    assert r1.status_code == 200
    assert r1["X-CACHE"] == "MISS"
    assert b"hello" in b"".join(r1.streaming_content)

    r2 = await async_client.get(
        proxy_url(), {"url": "http://example.org"}, headers=proxy_headers
    )
    assert r2.status_code == 200
    assert r2["X-CACHE"] == "HIT"
    assert b"hello" in b"".join(r2.streaming_content)

    assert len(calls) == 1


async def test_proxy_returns_400_on_upstream_error(
    async_client, proxy_cache_dir, proxy_headers, httpx_handler
):
    httpx_handler.handler = lambda request: httpx.Response(500)
    response = await async_client.get(
        proxy_url(), {"url": "http://example.org"}, headers=proxy_headers
    )
    assert response.status_code == 400


async def test_proxy_returns_400_on_timeout(
    async_client, proxy_cache_dir, proxy_headers, httpx_handler
):
    def handler(request):
        raise httpx.ReadTimeout("simulated timeout")

    httpx_handler.handler = handler
    response = await async_client.get(
        proxy_url(), {"url": "http://example.org"}, headers=proxy_headers
    )
    assert response.status_code == 400


async def test_proxy_falls_back_when_no_content_type(
    async_client, proxy_cache_dir, proxy_headers, httpx_handler
):
    httpx_handler.handler = lambda request: httpx.Response(200, content=b"data")
    response = await async_client.get(
        proxy_url(), {"url": "http://example.org"}, headers=proxy_headers
    )
    assert response.status_code == 200
    assert response["Content-Type"] == "application/octet-stream"


async def test_proxy_tolerates_raw_spaces_in_url(
    async_client, proxy_cache_dir, proxy_headers, httpx_handler
):
    # Historical regression (cf. changelog: "ajax proxy broken when using
    # overpass URL that includes spaces"): raw spaces in the proxied URL must
    # be encoded server-side instead of triggering URLValidator's rejection.
    seen = []

    def handler(request):
        seen.append(str(request.url))
        return httpx.Response(
            200, content=b"{}", headers={"content-type": "application/json"}
        )

    httpx_handler.handler = handler
    response = await async_client.get(
        proxy_url(),
        {"url": "http://overpass-api.de/api?data=foo bar"},
        headers=proxy_headers,
    )
    assert response.status_code == 200
    assert seen == ["http://overpass-api.de/api?data=foo+bar"]


async def test_proxy_clears_stale_semaphore(
    async_client, proxy_cache_dir, proxy_headers, httpx_handler
):
    # Simulate a worker that crashed mid-fetch and left the semaphore behind:
    # the next request should consider it stale, clear it, and proceed.
    target = "http://example.org"
    semaphore = proxy_cache_dir / f"{_cache_basename(target)}.tmp"
    semaphore.touch()
    stale_mtime = time.time() - 3600  # 1h ago, well past SEMAPHORE_TIMEOUT
    os.utime(semaphore, (stale_mtime, stale_mtime))

    response = await async_client.get(
        proxy_url(), {"url": target}, headers=proxy_headers
    )
    assert response.status_code == 200
    assert not semaphore.exists()


async def test_proxy_fast_path_ignores_held_semaphore(
    async_client, proxy_cache_dir, proxy_headers, httpx_handler
):
    # When the cache is fresh, a fresh-but-held semaphore (left by a concurrent
    # fetcher on a different URL, or an unrelated stuck request) must not block
    # the fast path.
    target = "http://example.org"
    calls = []

    def handler(request):
        calls.append(str(request.url))
        return httpx.Response(
            200, content=b"hello", headers={"content-type": "text/plain"}
        )

    httpx_handler.handler = handler

    # Populate the cache.
    r1 = await async_client.get(proxy_url(), {"url": target}, headers=proxy_headers)
    assert r1.status_code == 200
    assert r1["X-CACHE"] == "MISS"
    assert len(calls) == 1

    # Hold the semaphore (fresh mtime).
    semaphore = proxy_cache_dir / f"{_cache_basename(target)}.tmp"
    semaphore.touch()

    # Second request must HIT cache without waiting nor refetching.
    r2 = await async_client.get(proxy_url(), {"url": target}, headers=proxy_headers)
    assert r2.status_code == 200
    assert r2["X-CACHE"] == "HIT"
    assert len(calls) == 1  # no new fetch


async def test_proxy_does_not_cache_upstream_error(
    async_client, proxy_cache_dir, proxy_headers, httpx_handler
):
    # First call: upstream fails. Second call: upstream recovers. We must not
    # have cached the failure response.
    state = {"fail": True}

    def handler(request):
        if state["fail"]:
            return httpx.Response(500)
        return httpx.Response(
            200, content=b"recovered", headers={"content-type": "text/plain"}
        )

    httpx_handler.handler = handler

    r1 = await async_client.get(
        proxy_url(), {"url": "http://example.org"}, headers=proxy_headers
    )
    assert r1.status_code == 400

    state["fail"] = False
    r2 = await async_client.get(
        proxy_url(), {"url": "http://example.org"}, headers=proxy_headers
    )
    assert r2.status_code == 200
    assert b"recovered" in b"".join(r2.streaming_content)


async def test_proxy_rejects_redirect_to_private_ip(
    async_client, proxy_cache_dir, proxy_headers, httpx_handler
):
    # An attacker controls a public upstream that 302-redirects to a private
    # address (cloud metadata, internal service...). validate_url() approves the
    # public initial URL, so the redirect target must be revalidated before we
    # connect, otherwise the internal response would leak back to the caller.
    def handler(request):
        if request.url.host == "example.org":
            return httpx.Response(
                302, headers={"location": "http://169.254.169.254/latest/meta-data/"}
            )
        # Reached only if the redirect to the private IP is followed.
        return httpx.Response(
            200, content=b"SECRET-METADATA", headers={"content-type": "text/plain"}
        )

    httpx_handler.handler = handler

    response = await async_client.get(
        proxy_url(), {"url": "http://example.org"}, headers=proxy_headers
    )
    assert response.status_code == 400
    assert b"SECRET-METADATA" not in response.content


async def test_proxy_rejects_oversized_response(
    async_client, proxy_cache_dir, proxy_headers, httpx_handler, monkeypatch
):
    from umap.views import AjaxProxy

    monkeypatch.setattr(AjaxProxy, "MAX_BYTES", 8)
    httpx_handler.handler = lambda request: httpx.Response(
        200, content=b"way more than eight bytes", headers={"content-type": "text/csv"}
    )
    response = await async_client.get(
        proxy_url(), {"url": "http://example.org"}, headers=proxy_headers
    )
    assert response.status_code == 400
    # The oversized body must not have been cached.
    assert not list(proxy_cache_dir.glob("*.cache"))


async def test_proxy_sets_nosniff(
    async_client, proxy_cache_dir, proxy_headers, httpx_handler
):
    httpx_handler.handler = lambda request: httpx.Response(
        200, content=b"<script>", headers={"content-type": "text/html"}
    )
    response = await async_client.get(
        proxy_url(), {"url": "http://example.org"}, headers=proxy_headers
    )
    assert response.status_code == 200
    assert response["X-Content-Type-Options"] == "nosniff"


async def test_proxy_long_url_does_not_exceed_filename_limit(
    async_client, proxy_cache_dir, proxy_headers, httpx_handler
):
    httpx_handler.handler = lambda request: httpx.Response(
        200, content=b"OK", headers={"content-type": "text/plain"}
    )
    long_url = "http://example.org/?q=" + "a" * 500
    r1 = await async_client.get(proxy_url(), {"url": long_url}, headers=proxy_headers)
    assert r1.status_code == 200
    assert r1["X-CACHE"] == "MISS"
    assert b"OK" in b"".join(r1.streaming_content)
    expected_name = f"{_cache_basename(long_url)}.cache"
    assert len(expected_name) <= 255
    assert (proxy_cache_dir / expected_name).exists()

    # Should reuse the same cache file.
    r2 = await async_client.get(proxy_url(), {"url": long_url}, headers=proxy_headers)
    assert r2.status_code == 200
    assert r2["X-CACHE"] == "HIT"
    assert [f.name for f in proxy_cache_dir.glob("*.cache")] == [expected_name]


async def test_proxy_long_urls_with_common_prefix_do_not_collide(
    async_client, proxy_cache_dir, proxy_headers, httpx_handler
):
    # Two distinct URLs sharing a long common prefix must map to distinct cache
    # files. Truncating the (base64) URL to a fixed length used to make them
    # collide, so the second URL was served the first one's cached body.
    def handler(request):
        marker = request.url.query.decode() if request.url.query else ""
        return httpx.Response(
            200, content=marker.encode(), headers={"content-type": "text/plain"}
        )

    httpx_handler.handler = handler

    prefix = "http://example.org/?q=" + "a" * 300
    r1 = await async_client.get(
        proxy_url(), {"url": f"{prefix}FIRST"}, headers=proxy_headers
    )
    r2 = await async_client.get(
        proxy_url(), {"url": f"{prefix}SECOND"}, headers=proxy_headers
    )
    assert b"FIRST" in b"".join(r1.streaming_content)
    assert r2["X-CACHE"] == "MISS"
    assert b"SECOND" in b"".join(r2.streaming_content)
    assert len(list(proxy_cache_dir.glob("*.cache"))) == 2


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
        "teams_count": 0,
        "users_active_last_week_count": 0,
        "users_count": 0,
        "active_sessions": 0,
        "version": VERSION,
        "editors_count": 0,
        "members_count": 0,
        "orphans_count": 0,
        "owners_count": 0,
        "anonymous_allowed": False,
        "realtime_enabled": True,
        "routing_enabled": False,
        "importers": [],
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
        "teams_count": 0,
        "users_active_last_week_count": 1,
        "users_count": 2,
        "active_sessions": 0,
        "version": VERSION,
        "editors_count": 0,
        "members_count": 0,
        "orphans_count": 1,
        "owners_count": 1,
        "anonymous_allowed": False,
        "realtime_enabled": True,
        "routing_enabled": False,
        "importers": [],
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


@pytest.mark.django_db
def test_search(client, map):
    # Very basic search, that do not deal with accent nor case.
    # See install.md for how to have a smarter dict + index.
    map.name = "Blé dur"
    map.save()
    url = reverse("search")
    response = client.get(url + "?q=Blé")
    assert "Blé dur" in response.content.decode()


@pytest.mark.django_db
def test_cannot_search_blocked_map(client, map):
    map.name = "Blé dur"
    map.share_status = Map.BLOCKED
    map.save()
    url = reverse("search")
    response = client.get(url + "?q=Blé")
    assert "Blé dur" not in response.content.decode()


@pytest.mark.django_db
def test_cannot_search_deleted_map(client, map):
    map.name = "Blé dur"
    map.share_status = Map.DELETED
    map.save()
    url = reverse("search")
    response = client.get(url + "?q=Blé")
    assert "Blé dur" not in response.content.decode()


@pytest.mark.django_db
def test_filter_by_tag(client, map):
    # Very basic search, that do not deal with accent nor case.
    # See install.md for how to have a smarter dict + index.
    map.name = "Blé dur"
    map.tags = ["bike"]
    map.save()
    url = reverse("search")
    response = client.get(url + "?tags=bike")
    assert "Blé dur" in response.content.decode()


@pytest.mark.django_db
def test_can_combine_search_and_filter(client, map):
    # Very basic search, that do not deal with accent nor case.
    # See install.md for how to have a smarter dict + index.
    map.name = "Blé dur"
    map.tags = ["bike"]
    map.save()
    url = reverse("search")
    response = client.get(url + "?q=dur&tags=bike")
    assert "Blé dur" in response.content.decode()


@pytest.mark.django_db
def test_can_find_small_usernames(client):
    UserFactory(username="Joe")
    UserFactory(username="JoeJoe")
    UserFactory(username="Joe3")
    UserFactory(username="Joe57")
    UserFactory(username="JoeBar")
    url = "/agnocomplete/AutocompleteUser/"
    response = client.get(url + "?q=joe")
    data = json.loads(response.content)["data"]
    assert len(data) == 5
    assert data[0]["label"] == "Joe"
    response = client.get(url + "?q=joej")
    data = json.loads(response.content)["data"]
    assert len(data) == 1
    assert data[0]["label"] == "JoeJoe"


@pytest.mark.django_db
def test_templates_list(client, user, user2):
    public = MapFactory(
        owner=user,
        name="A public template",
        share_status=Map.PUBLIC,
        is_template=True,
    )
    link_only = MapFactory(
        owner=user,
        name="A link-only template",
        share_status=Map.OPEN,
        is_template=True,
    )
    private = MapFactory(
        owner=user,
        name="A link-only template",
        share_status=Map.PRIVATE,
        is_template=True,
    )
    someone_else = MapFactory(
        owner=user2,
        name="A public template from someone else",
        share_status=Map.PUBLIC,
        is_template=True,
    )
    staff = UserFactory(username="Staff", is_staff=True)
    Star.objects.create(by=staff, map=someone_else)
    client.login(username=user.username, password="123123")
    url = reverse("template_list")

    # Ask for mine
    response = client.get(f"{url}?source=mine")
    templates = json.loads(response.content)["templates"]
    ids = [t["id"] for t in templates]
    assert public.pk in ids
    assert link_only.pk in ids
    assert private.pk in ids
    assert someone_else.pk not in ids

    # Ask for staff ones
    response = client.get(f"{url}?source=staff")
    templates = json.loads(response.content)["templates"]
    ids = [t["id"] for t in templates]
    assert public.pk not in ids
    assert link_only.pk not in ids
    assert private.pk not in ids
    assert someone_else.pk in ids

    # Ask for community ones
    response = client.get(f"{url}?source=community")
    templates = json.loads(response.content)["templates"]
    ids = [t["id"] for t in templates]
    assert public.pk in ids
    assert link_only.pk not in ids
    assert private.pk not in ids
    assert someone_else.pk in ids
