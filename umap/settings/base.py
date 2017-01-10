# -*- coding:utf-8 -*-

"""Base settings shared by all environments"""
# Import global settings to make it easier to extend settings.
from django.conf.global_settings import *   # pylint: disable=W0614,W0401
from django.template.defaultfilters import slugify

#==============================================================================
# Generic Django project settings
#==============================================================================

DEBUG = True

SITE_ID = 1
# Local time zone for this installation. Choices can be found here:
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
TIME_ZONE = 'UTC'
USE_TZ = True
USE_I18N = True
USE_L10N = True
LANGUAGE_CODE = 'en'
LANGUAGES = (
    ('en', 'English'),
    ('fr', u'Francais'),
    ('it', u'Italiano'),
    ('pt', u'Portuguese'),
    ('nl', u'Dutch'),
    ('es', u'Español'),
    ('fi', u'Finnish'),
    ('de', u'Deutsch'),
    ('da', u'Danish'),
    ('ja', u'Japanese'),
    ('lt', u'Lithuanian'),
    ('cs-cz', u'Czech'),
    ('ca', u'Catalan'),
    ('zh', u'Chinese'),
    ('zh-tw', u'Chinese'),
    ('ru', u'Russian'),
    ('bg', u'Bulgarian'),
    ('vi', u'Vietnamese'),
    ('uk-ua', u'Ukrainian'),
    ('am-et', u'Amharic'),
    ('sk-sk', 'Slovak'),
)

# Make this unique, and don't share it with anybody.
SECRET_KEY = ''

INSTALLED_APPS = (
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.sites',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.admin',
    'django.contrib.gis',

    'leaflet_storage',
    'umap',
    'compressor',
    'social_django',
)

# =============================================================================
# Calculation of directories relative to the project module location
# =============================================================================

import os
import umap as project_module

PROJECT_DIR = os.path.dirname(os.path.realpath(project_module.__file__))

# =============================================================================
# Project URLS and media settings
# =============================================================================

ROOT_URLCONF = 'umap.urls'
WSGI_APPLICATION = 'umap.wsgi.application'

LOGIN_URL = '/login/'
LOGOUT_URL = '/logout/'
LOGIN_REDIRECT_URL = '/'

STATIC_URL = '/static/'
MEDIA_URL = '/uploads/'

STATIC_ROOT = os.path.join('static')
MEDIA_ROOT = os.path.join('uploads')


STATICFILES_DIRS = (
    os.path.join(PROJECT_DIR, 'static'),
)

STATICFILES_FINDERS = [
    'compressor.finders.CompressorFinder',
    # 'npm.finders.NpmFinder',
] + STATICFILES_FINDERS

# =============================================================================
# Templates
# =============================================================================

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'APP_DIRS': True,
        'DIRS': [
            os.path.join(PROJECT_DIR, 'templates'),
        ],
        'OPTIONS': {
            'context_processors': (
                'django.contrib.auth.context_processors.auth',
                'django.template.context_processors.debug',
                'django.template.context_processors.i18n',
                'django.template.context_processors.request',
                'django.template.context_processors.media',
                'django.template.context_processors.static',
                'django.template.context_processors.tz',
                'social_django.context_processors.backends',
                'social_django.context_processors.login_redirect',
                'umap.context_processors.settings',
                'umap.context_processors.version',
            )
        }
    },
]


# =============================================================================
# Middleware
# =============================================================================

MIDDLEWARE_CLASSES = (
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
)

# =============================================================================
# Auth / security
# =============================================================================

ENABLE_ACCOUNT_LOGIN = False
AUTHENTICATION_BACKENDS += (
)

# =============================================================================
# Miscellaneous project settings
# =============================================================================
LEAFLET_STORAGE_ALLOW_ANONYMOUS = False
LEAFLET_STORAGE_EXTRA_URLS = {
    'routing': 'http://www.openstreetmap.org/directions?engine=osrm_car&route={lat},{lng}&locale={locale}#map={zoom}/{lat}/{lng}',  # noqa
    'ajax_proxy': '/ajax-proxy/?url={url}'
}
LEAFLET_STORAGE_KEEP_VERSIONS = 10
SITE_URL = "http://umap.org"
SITE_NAME = 'uMap'
UMAP_DEMO_SITE = False
UMAP_EXCLUDE_DEFAULT_MAPS = False
UMAP_MAPS_PER_PAGE = 5
UMAP_MAPS_PER_PAGE_OWNER = 10
MAP_SHORT_URL_NAME = "umap_short_url"
UMAP_USE_UNACCENT = False
UMAP_FEEDBACK_LINK = "https://wiki.openstreetmap.org/wiki/UMap#Feedback_and_help"  # noqa
USER_MAPS_URL = 'user_maps'

# =============================================================================
# Third party app settings
# =============================================================================
COMPRESS_ENABLED = True
COMPRESS_OFFLINE = True

SOCIAL_AUTH_DEFAULT_USERNAME = lambda u: slugify(u)
SOCIAL_AUTH_ASSOCIATE_BY_EMAIL = True
LOGIN_URL = "login"
SOCIAL_AUTH_LOGIN_REDIRECT_URL = "/login/popup/end/"
SOCIAL_AUTH_PIPELINE = (
    'social_core.pipeline.social_auth.social_details',
    'social_core.pipeline.social_auth.social_uid',
    'social_core.pipeline.social_auth.auth_allowed',
    'social_core.pipeline.social_auth.social_user',
    'social_core.pipeline.social_auth.associate_by_email',
    'social_core.pipeline.user.get_username',
    'social_core.pipeline.user.create_user',
    'social_core.pipeline.social_auth.associate_user',
    'social_core.pipeline.social_auth.load_extra_data',
    'social_core.pipeline.user.user_details'
)
