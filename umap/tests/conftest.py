import shutil
import tempfile

import pytest
from django.core.cache import cache
from django.core.signing import get_cookie_signer

from umap.models import Map

from .base import (
    DataLayerFactory,
    LicenceFactory,
    MapFactory,
    TeamFactory,
    TileLayerFactory,
    UserFactory,
)

TMP_ROOT = tempfile.mkdtemp()


def pytest_configure(config):
    from django.conf import settings

    settings.MEDIA_ROOT = TMP_ROOT


def pytest_runtest_teardown():
    shutil.rmtree(TMP_ROOT, ignore_errors=True)
    cache.clear()


@pytest.fixture
def team():
    return TeamFactory()


@pytest.fixture
def user():
    return UserFactory(password="123123")


@pytest.fixture
def user2():
    return UserFactory(username="Averell", password="456456")


@pytest.fixture
def licence():
    return LicenceFactory()


@pytest.fixture
def map(licence, tilelayer):
    user = UserFactory(username="Gabriel", password="123123")
    return MapFactory(owner=user, licence=licence)


@pytest.fixture
def openmap(map):
    map.edit_status = Map.ANONYMOUS
    map.save()
    return map


@pytest.fixture
def anonymap(map):
    map.owner = None
    map.save()
    return map


@pytest.fixture
def cookieclient(client, map):
    key, value = map.signed_cookie_elements
    client.cookies[key] = get_cookie_signer(salt=key).sign(value)
    return client


@pytest.fixture
def allow_anonymous(settings):
    settings.UMAP_ALLOW_ANONYMOUS = True


@pytest.fixture
def datalayer(map):
    return DataLayerFactory(map=map)


@pytest.fixture
def tilelayer():
    return TileLayerFactory()


@pytest.fixture
def fake_request(rf):
    return rf.get("/")
