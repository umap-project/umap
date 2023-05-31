import os

from umap.settings.base import *  # pylint: disable=W0614,W0401

SECRET_KEY = "justfortests"
COMPRESS_ENABLED = False
FROM_EMAIL = "test@test.org"
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'

if "TRAVIS" in os.environ:
    DATABASES = {
        "default": {
            "ENGINE": "django.contrib.gis.db.backends.postgis",
            "NAME": "umap",
            "PORT": 5433,
            "USER": "travis",
        }
    }
