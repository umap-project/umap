import socket
import stat
from pathlib import Path

import pytest
from django.conf import settings
from django.test import RequestFactory

from umap.utils import gzip_file, normalize_string, validate_url


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
