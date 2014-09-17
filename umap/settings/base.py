# -*- coding:utf-8 -*-

"""Base settings shared by all environments"""
# Import global settings to make it easier to extend settings.
from django.conf.global_settings import *   # pylint: disable=W0614,W0401
from django.template.defaultfilters import slugify

#==============================================================================
# Generic Django project settings
#==============================================================================

DEBUG = True
TEMPLATE_DEBUG = DEBUG

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
)

# Make this unique, and don't share it with anybody.
SECRET_KEY = ''

INSTALLED_APPS = (
    'leaflet_storage',
    'umap',
    'pgindex',
    'compressor',
    'social.apps.django_app.default',

    'south',

    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.sites',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.admin',
    'django.contrib.admindocs',
    'django.contrib.gis'
)

#==============================================================================
# Calculation of directories relative to the project module location
#==============================================================================

import os
import umap as project_module

PROJECT_DIR = os.path.dirname(os.path.realpath(project_module.__file__))

#==============================================================================
# Project URLS and media settings
#==============================================================================

ROOT_URLCONF = 'umap.urls'

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

STATICFILES_FINDERS += (
    'compressor.finders.CompressorFinder',
)

#==============================================================================
# Templates
#==============================================================================

TEMPLATE_DIRS = (
    os.path.join(PROJECT_DIR, 'templates'),
)

TEMPLATE_CONTEXT_PROCESSORS += (
    'django.core.context_processors.request',
    'social.apps.django_app.context_processors.backends',
    'social.apps.django_app.context_processors.login_redirect',
    'umap.context_processors.feedback_link',
    'umap.context_processors.version',
)

TEMPLATE_LOADERS = (
    ('django.template.loaders.cached.Loader', TEMPLATE_LOADERS),
)

#==============================================================================
# Middleware
#==============================================================================

MIDDLEWARE_CLASSES = (
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.http.ConditionalGetMiddleware',
)

#==============================================================================
# Auth / security
#==============================================================================

AUTHENTICATION_BACKENDS += (
)

#==============================================================================
# Miscellaneous project settings
#==============================================================================
LEAFLET_STORAGE_ALLOW_ANONYMOUS = False
LEAFLET_STORAGE_EXTRA_URLS = {
    'routing': 'http://map.project-osrm.org/?loc={lat},{lng}&hl={locale}',
    'ajax_proxy': '/ajax-proxy/?url={url}'
}
SITE_URL = "http://umap.org"
UMAP_DEMO_SITE = False
MAP_SHORT_URL_NAME = "umap_short_url"
UMAP_USE_UNACCENT = False
UMAP_FEEDBACK_LINK = "http://wiki.openstreetmap.org/wiki/UMap#Feedback_and_help"

#==============================================================================
# Third party app settings
#==============================================================================
COMPRESS_ENABLED = True
COMPRESS_OFFLINE = True

SOCIAL_AUTH_DEFAULT_USERNAME = lambda u: slugify(u)
SOCIAL_AUTH_ASSOCIATE_BY_EMAIL = True
LOGIN_URL = "login"
SOCIAL_AUTH_LOGIN_REDIRECT_URL = "/login/popup/end/"
SOCIAL_AUTH_PIPELINE = (
    'social.pipeline.social_auth.social_details',
    'social.pipeline.social_auth.social_uid',
    'social.pipeline.social_auth.auth_allowed',
    'social.pipeline.social_auth.social_user',
    'social.pipeline.social_auth.associate_by_email',
    'social.pipeline.user.get_username',
    'social.pipeline.user.create_user',
    'social.pipeline.social_auth.associate_user',
    'social.pipeline.social_auth.load_extra_data',
    'social.pipeline.user.user_details'
)
