import shutil
import tempfile

import pytest
from django.core.signing import get_cookie_signer

from .base import (DataLayerFactory, LicenceFactory, MapFactory,
                   TileLayerFactory, UserFactory)

TMP_ROOT = tempfile.mkdtemp()


def pytest_configure(config):
    from django.conf import settings
    settings.MEDIA_ROOT = TMP_ROOT


def pytest_unconfigure(config):
    shutil.rmtree(TMP_ROOT, ignore_errors=True)


@pytest.fixture
def user():
    return UserFactory(password="123123")


@pytest.fixture
def licence():
    return LicenceFactory()


@pytest.fixture
def map(licence, tilelayer):
    user = UserFactory(username="Gabriel", password="123123")
    return MapFactory(owner=user, licence=licence)


@pytest.fixture
def anonymap(map):
    map.owner = None
    map.save()
    return map


@pytest.fixture
def cookieclient(client, anonymap):
    key, value = anonymap.signed_cookie_elements
    client.cookies[key] = get_cookie_signer(salt=key).sign(value)
    return client


@pytest.fixture
def allow_anonymous(settings):
    settings.LEAFLET_STORAGE_ALLOW_ANONYMOUS = True


@pytest.fixture
def datalayer(map):
    return DataLayerFactory(map=map, name="Default Datalayer")


@pytest.fixture
def tilelayer():
    return TileLayerFactory()
