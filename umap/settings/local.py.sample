# -*- coding:utf-8 -*-

"""
Example settings for local development

Use this file as a base for your local development settings and copy
it to umap/settings/local.py. It should not be checked into
your code repository.

"""

from umap.settings.base import *  # pylint: disable=W0614,W0401

SECRET_KEY = "!!change me!!"
INTERNAL_IPS = ("127.0.0.1",)
ALLOWED_HOSTS = [
    "*",
]

DEBUG = True

ADMINS = (("You", "your@email"),)
MANAGERS = ADMINS

DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": "umap",
    }
}

LANGUAGE_CODE = "en"

# Set to False if login into django account should not be possible. You can
# administer accounts in the admin interface.
ENABLE_ACCOUNT_LOGIN = True

AUTHENTICATION_BACKENDS = (
    "social_core.backends.github.GithubOAuth2",
    "social_core.backends.bitbucket.BitbucketOAuth",
    "social_core.backends.twitter.TwitterOAuth",
    "social_core.backends.openstreetmap.OpenStreetMapOAuth",
    "django.contrib.auth.backends.ModelBackend",
)
SOCIAL_AUTH_GITHUB_KEY = "xxx"
SOCIAL_AUTH_GITHUB_SECRET = "xxx"
SOCIAL_AUTH_BITBUCKET_KEY = "xxx"
SOCIAL_AUTH_BITBUCKET_SECRET = "xxx"
# We need email to associate with other Oauth providers
SOCIAL_AUTH_GITHUB_SCOPE = [
    "user:email",
]
SOCIAL_AUTH_TWITTER_KEY = "xxx"
SOCIAL_AUTH_TWITTER_SECRET = "xxx"
SOCIAL_AUTH_OPENSTREETMAP_OAUTH2_KEY = "xxx"
SOCIAL_AUTH_OPENSTREETMAP_OAUTH2_SECRET = "xxx"
MIDDLEWARE += ("social_django.middleware.SocialAuthExceptionMiddleware",)
SOCIAL_AUTH_REDIRECT_IS_HTTPS = True
SOCIAL_AUTH_RAISE_EXCEPTIONS = False
SOCIAL_AUTH_BACKEND_ERROR_URL = "/"

# If you want to add a playgroud map, add its primary key
# UMAP_DEMO_PK = 204
# If you want to add a showcase map on the home page, add its primary key
# UMAP_SHOWCASE_PK = 1156
# Add a baner to warn people this instance is not production ready.
UMAP_DEMO_SITE = True

# Whether to allow non authenticated people to create maps.
UMAP_ALLOW_ANONYMOUS = True

# This setting will exclude empty maps (in fact, it will exclude all maps where
# the default center has not been updated)
UMAP_EXCLUDE_DEFAULT_MAPS = False

# How many maps should be showcased on the main page resp. on the user page
UMAP_MAPS_PER_PAGE = 5
# How many maps should be looked for when performing a (sub)search
UMAP_MAPS_PER_SEARCH = 15
# How many maps should be showcased on the user page, if owner
UMAP_MAPS_PER_PAGE_OWNER = 10

SITE_URL = "http://localhost:8019"
SHORT_SITE_URL = "http://s.hort"

# CACHES = {
#     'default': {
#         'BACKEND': 'django.core.cache.backends.filebased.FileBasedCache',
#         'LOCATION': '/var/tmp/django_cache',
#     }
# }

# POSTGIS_VERSION = (2, 1, 0)
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# Put the site in readonly mode (useful for migration or any maintenance)
UMAP_READONLY = False


# For static deployment
STATIC_ROOT = "/srv/umap/var/static"

# For users' statics (geojson mainly)
MEDIA_ROOT = "/srv/umap/var/data"

# Default map location for new maps
LEAFLET_LONGITUDE = 2
LEAFLET_LATITUDE = 51
LEAFLET_ZOOM = 6

# Number of old version to keep per datalayer.
UMAP_KEEP_VERSIONS = 10
