import os
import time

import pytest
from django.core.management import call_command


@pytest.fixture
def cache_dir(settings, tmp_path):
    settings.AJAX_PROXY_CACHE_DIR = str(tmp_path)
    return tmp_path


def _touch(path, age_seconds):
    path.touch()
    mtime = time.time() - age_seconds
    os.utime(path, (mtime, mtime))


def test_clear_proxy_cache_removes_old_entries(cache_dir, capsys):
    fresh = cache_dir / "umap_fresh.cache"
    stale = cache_dir / "umap_stale.cache"
    stale_sem = cache_dir / "umap_stale.tmp"
    in_flight = cache_dir / "umap_stale.cache.abc123"  # NamedTemporaryFile-style
    unrelated = cache_dir / "other_user_data.bin"

    _touch(fresh, age_seconds=10)
    _touch(stale, age_seconds=100_000)
    _touch(stale_sem, age_seconds=100_000)
    _touch(in_flight, age_seconds=100_000)
    _touch(unrelated, age_seconds=100_000)

    call_command("clear_proxy_cache", "--max-age", "86400")

    assert fresh.exists()
    assert not stale.exists()
    assert not stale_sem.exists()
    assert in_flight.exists()  # not our suffix → untouched
    assert unrelated.exists()  # not our prefix → untouched


def test_clear_proxy_cache_dry_run(cache_dir):
    stale = cache_dir / "umap_stale.cache"
    _touch(stale, age_seconds=100_000)

    call_command("clear_proxy_cache", "--max-age", "86400", "--dry-run")

    assert stale.exists()
