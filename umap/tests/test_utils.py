from pathlib import Path

from umap.utils import gzip_file


def test_gzip_file():
    # Let's use any old file so we can check that the date of the gzip file is set.
    src = Path(__file__).parent / "settings.py"
    dest = Path("/tmp/test_settings.py.gz")
    gzip_file(src, dest)
    src_stat = src.stat()
    dest_stat = dest.stat()
    dest.unlink()
    assert src_stat.st_mtime == dest_stat.st_mtime
