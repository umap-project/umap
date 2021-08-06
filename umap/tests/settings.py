import os

from umap.settings.base import *  # pylint: disable=W0614,W0401

SECRET_KEY = "justfortests"
COMPRESS_ENABLED = False

if "TRAVIS" in os.environ:
    DATABASES = {
        "default": {
            "ENGINE": "django.contrib.gis.db.backends.postgis",
            "NAME": "umap",
            "PORT": 5433,
            "USER": "travis",
        }
    }
