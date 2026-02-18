import stat
from pathlib import Path

import pytest

from umap.utils import gzip_file, layers_tree, normalize_string

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
            "layers": [
                {
                    "name": p1_child1.name,
                    "browsable": True,
                    "displayOnLoad": True,
                    "id": p1_child1.pk,
                    "rank": 0,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "_referenceVersion": p1_child1.reference_version,
                },
                {
                    "name": p1_child2.name,
                    "browsable": True,
                    "displayOnLoad": True,
                    "id": p1_child2.pk,
                    "rank": 1,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "_referenceVersion": p1_child2.reference_version,
                },
            ],
            "name": parent1.name,
            "browsable": True,
            "displayOnLoad": True,
            "id": parent1.pk,
            "rank": 0,
            "permissions": {"edit_status": 0},
            "editMode": "disabled",
            "_referenceVersion": parent1.reference_version,
        },
        {
            "layers": [
                {
                    "layers": [
                        {
                            "_referenceVersion": p2_grandchild1.reference_version,
                            "browsable": True,
                            "displayOnLoad": True,
                            "editMode": "disabled",
                            "id": p2_grandchild1.pk,
                            "name": "p2 grandchild 1",
                            "permissions": {
                                "edit_status": 0,
                            },
                            "rank": 0,
                        },
                        {
                            "_referenceVersion": p2_grandchild2.reference_version,
                            "browsable": True,
                            "displayOnLoad": True,
                            "editMode": "disabled",
                            "id": p2_grandchild2.pk,
                            "name": "p2 grandchild 2",
                            "permissions": {
                                "edit_status": 0,
                            },
                            "rank": 0,
                        },
                    ],
                    "name": p2_child1.name,
                    "browsable": True,
                    "displayOnLoad": True,
                    "id": p2_child1.pk,
                    "rank": 0,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "_referenceVersion": p2_child1.reference_version,
                },
                {
                    "name": p2_child2.name,
                    "browsable": True,
                    "displayOnLoad": True,
                    "id": p2_child2.pk,
                    "rank": 1,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "_referenceVersion": p2_child2.reference_version,
                },
            ],
            "name": parent2.name,
            "browsable": True,
            "displayOnLoad": True,
            "id": parent2.pk,
            "rank": 1,
            "permissions": {"edit_status": 0},
            "editMode": "disabled",
            "_referenceVersion": parent2.reference_version,
        },
    ]
    assert tree == expected

    # Now without ids
    tree = layers_tree([d.metadata() for d in map.datalayers], keep_ids=False)
    expected = [
        {
            "layers": [
                {
                    "name": p1_child1.name,
                    "browsable": True,
                    "displayOnLoad": True,
                    "rank": 0,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "_referenceVersion": p1_child1.reference_version,
                },
                {
                    "name": p1_child2.name,
                    "browsable": True,
                    "displayOnLoad": True,
                    "rank": 1,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "_referenceVersion": p1_child2.reference_version,
                },
            ],
            "name": parent1.name,
            "browsable": True,
            "displayOnLoad": True,
            "rank": 0,
            "permissions": {"edit_status": 0},
            "editMode": "disabled",
            "_referenceVersion": parent1.reference_version,
        },
        {
            "layers": [
                {
                    "layers": [
                        {
                            "_referenceVersion": p2_grandchild1.reference_version,
                            "browsable": True,
                            "displayOnLoad": True,
                            "editMode": "disabled",
                            "name": "p2 grandchild 1",
                            "permissions": {
                                "edit_status": 0,
                            },
                            "rank": 0,
                        },
                        {
                            "_referenceVersion": p2_grandchild2.reference_version,
                            "browsable": True,
                            "displayOnLoad": True,
                            "editMode": "disabled",
                            "name": "p2 grandchild 2",
                            "permissions": {
                                "edit_status": 0,
                            },
                            "rank": 0,
                        },
                    ],
                    "name": p2_child1.name,
                    "browsable": True,
                    "displayOnLoad": True,
                    "rank": 0,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "_referenceVersion": p2_child1.reference_version,
                },
                {
                    "name": p2_child2.name,
                    "browsable": True,
                    "displayOnLoad": True,
                    "rank": 1,
                    "permissions": {"edit_status": 0},
                    "editMode": "disabled",
                    "_referenceVersion": p2_child2.reference_version,
                },
            ],
            "name": parent2.name,
            "browsable": True,
            "displayOnLoad": True,
            "rank": 1,
            "permissions": {"edit_status": 0},
            "editMode": "disabled",
            "_referenceVersion": parent2.reference_version,
        },
    ]
    assert tree == expected
