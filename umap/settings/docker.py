# -*- coding:utf-8 -*-
"""
Settings for Docker development

Use this file as a base for your local development settings and copy
it to umap/settings/local.py. It should not be checked into
your code repository.
"""
import environ
from umap.settings.base import *   # pylint: disable=W0614,W0401

env = environ.Env()

SECRET_KEY = env('SECRET_KEY')
INTERNAL_IPS = env.list('INTERNAL_IPS', default='127.0.0.1')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default='*')

DEBUG = env.bool('DEBUG', default=False)

ADMIN_EMAILS = env.list('ADMIN_EMAIL', default='')
ADMINS = [(email, email) for email in ADMIN_EMAILS]
MANAGERS = ADMINS

DATABASES = {
    'default': env.db(default='postgis://localhost:5432/umap')
}

COMPRESS_ENABLED = True
COMPRESS_OFFLINE = True

LANGUAGE_CODE = 'en'

# Set to False if login into django account should not be possible. You can
# administer accounts in the admin interface.
ENABLE_ACCOUNT_LOGIN = env.bool('ENABLE_ACCOUNT_LOGIN', default=True)

AUTHENTICATION_BACKENDS = ()

# We need email to associate with other Oauth providers
SOCIAL_AUTH_GITHUB_SCOPE = ['user:email']
SOCIAL_AUTH_GITHUB_KEY = env('GITHUB_KEY', default='')
SOCIAL_AUTH_GITHUB_SECRET = env('GITHUB_SECRET', default='')
if SOCIAL_AUTH_GITHUB_KEY and SOCIAL_AUTH_GITHUB_SECRET:
    AUTHENTICATION_BACKENDS += (
        'social_core.backends.github.GithubOAuth2',
    )
SOCIAL_AUTH_BITBUCKET_KEY = env('BITBUCKET_KEY', default='')
SOCIAL_AUTH_BITBUCKET_SECRET = env('BITBUCKET_SECRET', default='')
if SOCIAL_AUTH_BITBUCKET_KEY and SOCIAL_AUTH_BITBUCKET_SECRET:
    AUTHENTICATION_BACKENDS += (
        'social_core.backends.bitbucket.BitbucketOAuth',
    )

SOCIAL_AUTH_TWITTER_KEY = env('TWITTER_KEY', default='')
SOCIAL_AUTH_TWITTER_SECRET = env('TWITTER_SECRET', default='')
if SOCIAL_AUTH_TWITTER_KEY and SOCIAL_AUTH_TWITTER_SECRET:
    AUTHENTICATION_BACKENDS += (
        'social_core.backends.twitter.TwitterOAuth',
    )
SOCIAL_AUTH_OPENSTREETMAP_KEY = env('OPENSTREETMAP_KEY', default='')
SOCIAL_AUTH_OPENSTREETMAP_SECRET = env('OPENSTREETMAP_SECRET', default='')
if SOCIAL_AUTH_OPENSTREETMAP_KEY and SOCIAL_AUTH_OPENSTREETMAP_SECRET:
    AUTHENTICATION_BACKENDS += (
        'social_core.backends.openstreetmap.OpenStreetMapOAuth',
    )

AUTHENTICATION_BACKENDS += (
    'django.contrib.auth.backends.ModelBackend',
)

MIDDLEWARE_CLASSES += (
    'social_django.middleware.SocialAuthExceptionMiddleware',
)

SOCIAL_AUTH_RAISE_EXCEPTIONS = False
SOCIAL_AUTH_BACKEND_ERROR_URL = "/"

# If you want to add a playgroud map, add its primary key
# UMAP_DEMO_PK = 204
# If you want to add a showcase map on the home page, add its primary key
# UMAP_SHOWCASE_PK = 1156
# Add a baner to warn people this instance is not production ready.
UMAP_DEMO_SITE = False

# Whether to allow non authenticated people to create maps.
LEAFLET_STORAGE_ALLOW_ANONYMOUS = env.bool(
    'LEAFLET_STORAGE_ALLOW_ANONYMOUS',
    default=False,
)

# This setting will exclude empty maps (in fact, it will exclude all maps where
# the default center has not been updated)
UMAP_EXCLUDE_DEFAULT_MAPS = False

# How many maps should be showcased on the main page resp. on the user page
UMAP_MAPS_PER_PAGE = 5
# How many maps should be showcased on the user page, if owner
UMAP_MAPS_PER_PAGE_OWNER = 10

SITE_URL = env('SITE_URL')
SHORT_SITE_URL = env('SHORT_SITE_URL', default=None)

CACHES = {'default': env.cache('REDIS_URL', default='locmem://')}

# POSTGIS_VERSION = (2, 1, 0)
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# You need to unable accent extension before using UMAP_USE_UNACCENT
# python manage.py dbshell
# CREATE EXTENSION unaccent;
UMAP_USE_UNACCENT = False

# For static deployment
STATIC_ROOT = '/srv/umap/static'

# For users' statics (geojson mainly)
MEDIA_ROOT = '/srv/umap/uploads'

# Default map location for new maps
LEAFLET_LONGITUDE = env.int('LEAFLET_LONGITUDE', default=2)
LEAFLET_LATITUDE = env.int('LEAFLET_LATITUDE', default=51)
LEAFLET_ZOOM = env.int('LEAFLET_ZOOM', default=6)

# Number of old version to keep per datalayer.
LEAFLET_STORAGE_KEEP_VERSIONS = env.int(
    'LEAFLET_STORAGE_KEEP_VERSIONS',
    default=10,
)
