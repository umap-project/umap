import socket
import stat
from pathlib import Path

import pytest
from django.conf import settings
from django.test import RequestFactory

from umap.utils import gzip_file, layers_tree, normalize_string, validate_url

from .base import DataLayerFactory

pytestmark = pytest.mark.django_db


def test_gzip_file(settings):
    settings.FILE_UPLOAD_PERMISSIONS = 0o666
    # Let's use any old file so we can check that the date of the gzip file is set.
    src = Path(__file__).parent / "settings.py"
    dest = Path("/tmp/test_settings.py.gz")
    gzip_file(src, dest)
    src_stat = src.stat()
    dest_stat = dest.stat()
    dest.unlink()
    assert src_stat.st_mtime == dest_stat.st_mtime
    assert stat.filemode(dest_stat.st_mode) == "-rw-rw-rw-"


@pytest.mark.parametrize(
    "input,output",
    (
        ("Vélo", "velo"),
        ("Éducation", "education"),
        ("stävänger", "stavanger"),
    ),
)
def test_normalize_string(input, output):
    assert normalize_string(input) == output


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
    with pytest.raises(ValueError):
        validate_url(request)


def test_relative_url_raises():
    request = get("/just/a/path/")
    with pytest.raises(ValueError):
        validate_url(request)


def test_file_uri_raises():
    request = get("file:///etc/passwd")
    with pytest.raises(ValueError):
        validate_url(request)


def test_localhost_raises():
    request = get("http://localhost/path/")
    with pytest.raises(ValueError):
        validate_url(request)


def test_local_IP_raises():
    url = "http://{}/path/".format(socket.gethostname())
    request = get(url)
    with pytest.raises(ValueError):
        validate_url(request)


def test_POST_raises():
    request = get(verb="post")
    with pytest.raises(ValueError):
        validate_url(request)


def test_unknown_domain_raises():
    request = get("http://xlkjdkjsdlkjfd.com")
    with pytest.raises(ValueError):
        validate_url(request)


def test_invalid_url_raises():
    request = get("http:/foobar.com")
    with pytest.raises(ValueError):
        validate_url(request)


def test_layers_tree(map):
    parent1 = DataLayerFactory(name="parent 1", rank=0, map=map)
    parent2 = DataLayerFactory(name="parent 2", rank=1, map=map)
    p1_child2 = DataLayerFactory(name="p1 child 2", rank=1, parent=parent1, map=map)
    p1_child1 = DataLayerFactory(name="p1 child 1", rank=0, parent=parent1, map=map)
    p2_child2 = DataLayerFactory(name="p2 child 2", rank=1, parent=parent2, map=map)
    p2_child1 = DataLayerFactory(name="p2 child 1", rank=0, parent=parent2, map=map)
    p2_grandchild1 = DataLayerFactory(
        name="p2 grandchild 1", rank=0, parent=p2_child1, map=map
    )
    p2_grandchild2 = DataLayerFactory(
        name="p2 grandchild 2", rank=0, parent=p2_child1, map=map
    )
    tree = layers_tree([d.metadata() for d in map.datalayers])
    expected = [
        {
            "properties": {
                "name": parent1.name,
                "browsable": True,
                "displayOnLoad": True,
            },
            "id": parent1.pk,
            "rank": 0,
            "permissions": {"edit_status": 0},
            "editMode": "disabled",
            "referenceVersion": parent1.reference_version,
            "layers": [
                {
                    "properties": {
                        "name": p1_child1.name,
                        "browsable": True,
                        "displayOnLoad": True,
                    },
                    "id": p1_child1.pk,
                    "rank": 0,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "referenceVersion": p1_child1.reference_version,
                },
                {
                    "properties": {
                        "name": p1_child2.name,
                        "browsable": True,
                        "displayOnLoad": True,
                    },
                    "id": p1_child2.pk,
                    "rank": 1,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "referenceVersion": p1_child2.reference_version,
                },
            ],
        },
        {
            "properties": {
                "name": parent2.name,
                "browsable": True,
                "displayOnLoad": True,
            },
            "id": parent2.pk,
            "rank": 1,
            "permissions": {"edit_status": 0},
            "editMode": "disabled",
            "referenceVersion": parent2.reference_version,
            "layers": [
                {
                    "properties": {
                        "name": p2_child1.name,
                        "browsable": True,
                        "displayOnLoad": True,
                    },
                    "id": p2_child1.pk,
                    "rank": 0,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "referenceVersion": p2_child1.reference_version,
                    "layers": [
                        {
                            "properties": {
                                "browsable": True,
                                "displayOnLoad": True,
                                "name": "p2 grandchild 1",
                            },
                            "referenceVersion": p2_grandchild1.reference_version,
                            "editMode": "disabled",
                            "id": p2_grandchild1.pk,
                            "permissions": {
                                "edit_status": 0,
                            },
                            "rank": 0,
                        },
                        {
                            "properties": {
                                "name": "p2 grandchild 2",
                                "browsable": True,
                                "displayOnLoad": True,
                            },
                            "referenceVersion": p2_grandchild2.reference_version,
                            "editMode": "disabled",
                            "id": p2_grandchild2.pk,
                            "permissions": {
                                "edit_status": 0,
                            },
                            "rank": 0,
                        },
                    ],
                },
                {
                    "properties": {
                        "name": p2_child2.name,
                        "browsable": True,
                        "displayOnLoad": True,
                    },
                    "id": p2_child2.pk,
                    "rank": 1,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "referenceVersion": p2_child2.reference_version,
                },
            ],
        },
    ]
    assert tree == expected

    # Now without ids
    tree = layers_tree([d.metadata() for d in map.datalayers], keep_ids=False)
    expected = [
        {
            "properties": {
                "name": parent1.name,
                "browsable": True,
                "displayOnLoad": True,
            },
            "rank": 0,
            "permissions": {"edit_status": 0},
            "editMode": "disabled",
            "referenceVersion": parent1.reference_version,
            "layers": [
                {
                    "properties": {
                        "name": p1_child1.name,
                        "browsable": True,
                        "displayOnLoad": True,
                    },
                    "rank": 0,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "referenceVersion": p1_child1.reference_version,
                },
                {
                    "properties": {
                        "name": p1_child2.name,
                        "browsable": True,
                        "displayOnLoad": True,
                    },
                    "rank": 1,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "referenceVersion": p1_child2.reference_version,
                },
            ],
        },
        {
            "properties": {
                "name": parent2.name,
                "browsable": True,
                "displayOnLoad": True,
            },
            "rank": 1,
            "permissions": {"edit_status": 0},
            "editMode": "disabled",
            "referenceVersion": parent2.reference_version,
            "layers": [
                {
                    "properties": {
                        "name": p2_child1.name,
                        "browsable": True,
                        "displayOnLoad": True,
                    },
                    "rank": 0,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "referenceVersion": p2_child1.reference_version,
                    "layers": [
                        {
                            "properties": {
                                "browsable": True,
                                "displayOnLoad": True,
                                "name": "p2 grandchild 1",
                            },
                            "referenceVersion": p2_grandchild1.reference_version,
                            "editMode": "disabled",
                            "permissions": {
                                "edit_status": 0,
                            },
                            "rank": 0,
                        },
                        {
                            "properties": {
                                "browsable": True,
                                "displayOnLoad": True,
                                "name": "p2 grandchild 2",
                            },
                            "referenceVersion": p2_grandchild2.reference_version,
                            "editMode": "disabled",
                            "permissions": {
                                "edit_status": 0,
                            },
                            "rank": 0,
                        },
                    ],
                },
                {
                    "properties": {
                        "name": p2_child2.name,
                        "browsable": True,
                        "displayOnLoad": True,
                    },
                    "rank": 1,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "referenceVersion": p2_child2.reference_version,
                },
            ],
        },
    ]
    assert tree == expected
