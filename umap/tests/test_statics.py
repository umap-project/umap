import json
import shutil
import tempfile
from copy import deepcopy
from pathlib import Path

import pytest
from django.core.management import call_command


@pytest.fixture
def staticfiles(settings):
    static_root = tempfile.mkdtemp(prefix="test_static")
    settings.STATIC_ROOT = static_root
    # Make sure settings are properly reset after the test
    settings.STORAGES = deepcopy(settings.STORAGES)
    settings.STORAGES["staticfiles"]["BACKEND"] = (
        "umap.storage.UmapManifestStaticFilesStorage"
    )
    try:
        call_command("collectstatic", "--noinput")
        yield
    finally:
        shutil.rmtree(static_root)


def test_collectstatic_ran_successfully_with_hashes(settings, staticfiles):
    static_root = settings.STATIC_ROOT
    manifest = Path(static_root) / "staticfiles.json"
    assert manifest.exists()
    json_manifest = json.loads(manifest.read_text())
    assert "hash" in json_manifest.keys()
    assert "umap/base.css" in json_manifest["paths"]
    # Hash + the dot ("umap/base.<hash>.css").
    md5_hash_lenght = 12 + 1
    # The value of the manifest must contain the hash (length).
    assert (
        len(json_manifest["paths"]["umap/base.css"])
        == len("umap/base.css") + md5_hash_lenght
    )
