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
    ('cs_CZ', u'Czech'),
)

# Make this unique, and don't share it with anybody.
SECRET_KEY = ''

INSTALLED_APPS = (
    'leaflet_storage',
    'umap',
    'sesql',
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
import sys
import umap as project_module

PROJECT_DIR = os.path.dirname(os.path.realpath(project_module.__file__))

PYTHON_BIN = os.path.dirname(sys.executable)
ve_path = os.path.dirname(os.path.dirname(os.path.dirname(PROJECT_DIR)))
# Assume that the presence of 'activate_this.py' in the python bin/
# directory means that we're running in a virtual environment.
if os.path.exists(os.path.join(PYTHON_BIN, 'activate_this.py')):
    # We're running with a virtualenv python executable.
    VAR_ROOT = os.path.join(os.path.dirname(PYTHON_BIN), 'var')
elif ve_path and os.path.exists(os.path.join(ve_path, 'bin',
        'activate_this.py')):
    # We're running in [virtualenv_root]/src/[project_name].
    VAR_ROOT = os.path.join(ve_path, 'var')
else:
    # Set the variable root to a path in the project which is
    # ignored by the repository.
    VAR_ROOT = os.path.join(PROJECT_DIR, 'var')

if not os.path.exists(VAR_ROOT):
    os.mkdir(VAR_ROOT)

#==============================================================================
# Project URLS and media settings
#==============================================================================

ROOT_URLCONF = 'umap.urls'

LOGIN_URL = '/login/'
LOGOUT_URL = '/logout/'
LOGIN_REDIRECT_URL = '/'

STATIC_URL = '/static/'
MEDIA_URL = '/uploads/'

STATIC_ROOT = os.path.join(VAR_ROOT, 'static')
MEDIA_ROOT = os.path.join(VAR_ROOT, 'uploads')

STATICFILES_DIRS = (
    # Fabric will collect leaflet and draw in this dir
    os.path.join(PROJECT_DIR, 'remote_static'),
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
)

#==============================================================================
# Middleware
#==============================================================================

MIDDLEWARE_CLASSES += (
    'django.middleware.locale.LocaleMiddleware',
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
    'routing': 'http://map.project-osrm.org/?loc={lat},{lng}&hl={locale}'
}
SITE_URL = "http://umap.org"
UMAP_DEMO_SITE = False
MAP_SHORT_URL_NAME = "umap_short_url"

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
