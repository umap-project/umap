import os
import tempfile
from pathlib import Path

from django.core.management import call_command


def test_purge_purgatory(settings):
    settings.UMAP_PURGATORY_ROOT = tempfile.mkdtemp()
    root = Path(settings.UMAP_PURGATORY_ROOT)
    old = root / "old.json"
    old.write_text("{}")
    stat = old.stat()
    os.utime(old, times=(stat.st_mtime - 31 * 86400, stat.st_mtime - 31 * 86400))
    recent = root / "recent.json"
    recent.write_text("{}")
    stat = recent.stat()
    os.utime(recent, times=(stat.st_mtime - 8 * 86400, stat.st_mtime - 8 * 86400))
    now = root / "now.json"
    now.write_text("{}")
    assert {f.name for f in root.iterdir()} == {"old.json", "recent.json", "now.json"}
    call_command("purge_purgatory")
    assert {f.name for f in root.iterdir()} == {"recent.json", "now.json"}
    call_command("purge_purgatory", "--days=7")
    assert {f.name for f in root.iterdir()} == {"now.json"}
