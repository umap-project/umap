import stat
from pathlib import Path

import pytest

from umap.utils import gzip_file, normalize_string


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
