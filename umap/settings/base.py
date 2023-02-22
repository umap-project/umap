"""Base settings shared by all environments"""
# Import global settings to make it easier to extend settings.
from django.template.defaultfilters import slugify
from django.conf.locale import LANG_INFO

# =============================================================================
# Generic Django project settings
# =============================================================================

DEBUG = True

SITE_ID = 1
# Add languages we're missing from Django
LANG_INFO.update({
    'am-et': {
        'bidi': False,
        'name': 'Amharic',
        'code': 'am-et',
        'name_local': 'አማርኛ'
    },
    'zh': {
        'bidi': False,
        'code': 'zh',
        'name': 'Chinese',
        'name_local': '简体中文',
    },
    'si': {
        'bidi': False,
        'code': 'si',
        'name': 'Sinhala',
        'name_local': 'සිංහල',
    },
})
# Local time zone for this installation. Choices can be found here:
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
TIME_ZONE = 'UTC'
USE_TZ = True
USE_I18N = True
LANGUAGE_CODE = 'en'
LANGUAGES = (
    ('am-et', 'Amharic'),
    ('ar', 'Arabic'),
    ('ast', 'Asturian'),
    ('bg', 'Bulgarian'),
    ('ca', 'Catalan'),
    ('cs-cz', 'Czech'),
    ('da', 'Danish'),
    ('de', 'German'),
    ('el', 'Greek'),
    ('en', 'English'),
    ('es', 'Spanish'),
    ('et', 'Estonian'),
    ('fi', 'Finnish'),
    ('fr', 'French'),
    ('gl', 'Galician'),
    ('he', 'Hebrew'),
    ('hr', 'Croatian'),
    ('hu', 'Hungarian'),
    ('id', 'Indonesian'),
    ('is', 'Icelandic'),
    ('it', 'Italian'),
    ('ja', 'Japanese'),
    ('ko', 'Korean'),
    ('lt', 'Lithuanian'),
    ('nl', 'Dutch'),
    ('no', 'Norwegian'),
    ('pl', 'Polish'),
    ('pt-br', 'Portuguese (Brazil)'),
    ('pt-pt', 'Portuguese (Portugal)'),
    ('ro', 'Romanian'),
    ('ru', 'Russian'),
    ('si-lk', 'Sinhala (Sri Lanka)'),
    ('sk-sk', 'Slovak'),
    ('sl', 'Slovenian'),
    ('sr', 'Serbian'),
    ('sv', 'Swedish'),
    ('th-th', 'Thai (Thailand)'),
    ('tr', 'Turkish'),
    ('uk-ua', 'Ukrainian'),
    ('vi', 'Vietnamese'),
    ('zh', 'Chinese'),
    ('zh-tw', 'Chinese (Taiwan)'),
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

    'umap',
    'compressor',
    'social_django',
    # See https://github.com/peopledoc/django-agnocomplete/commit/26eda2dfa4a2f8a805ca2ea19a0c504b9d773a1c
    # Django does not find the app config in the default place, so the app is not loaded
    # so the "autodiscover" is not run.
    'agnocomplete.app.AgnocompleteConfig',
)
DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'

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

STATICFILES_FINDERS = [
    'django.contrib.staticfiles.finders.FileSystemFinder',
    'django.contrib.staticfiles.finders.AppDirectoriesFinder',
    'compressor.finders.CompressorFinder',
]

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
                'django.contrib.messages.context_processors.messages',
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

MIDDLEWARE = (
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'umap.middleware.readonly_middleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
)


# =============================================================================
# Auth / security
# =============================================================================

ENABLE_ACCOUNT_LOGIN = False

# =============================================================================
# Miscellaneous project settings
# =============================================================================
UMAP_ALLOW_ANONYMOUS = False
UMAP_EXTRA_URLS = {
    'routing': 'http://www.openstreetmap.org/directions?engine=osrm_car&route={lat},{lng}&locale={locale}#map={zoom}/{lat}/{lng}',  # noqa
    'ajax_proxy': '/ajax-proxy/?url={url}&ttl={ttl}',
    'search': 'https://photon.komoot.io/api/?',
}
UMAP_KEEP_VERSIONS = 10
SITE_URL = "http://umap.org"
SITE_NAME = 'uMap'
UMAP_DEMO_SITE = False
UMAP_EXCLUDE_DEFAULT_MAPS = False
UMAP_MAPS_PER_PAGE = 5
UMAP_MAPS_PER_PAGE_OWNER = 10
UMAP_USE_UNACCENT = False
UMAP_FEEDBACK_LINK = "https://wiki.openstreetmap.org/wiki/UMap#Feedback_and_help"  # noqa
USER_MAPS_URL = 'user_maps'
DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': 'umap',
    }
}
UMAP_READONLY = False
LOCALE_PATHS = [os.path.join(PROJECT_DIR, 'locale')]

# =============================================================================
# Third party app settings
# =============================================================================
COMPRESS_ENABLED = True
COMPRESS_OFFLINE = True

SOCIAL_AUTH_DEFAULT_USERNAME = lambda u: slugify(u)
SOCIAL_AUTH_ASSOCIATE_BY_EMAIL = True
SOCIAL_AUTH_NO_DEFAULT_PROTECTED_USER_FIELDS = True
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
