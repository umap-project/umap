"""Base settings shared by all environments"""

# Import global settings to make it easier to extend settings.
import os
from email.utils import parseaddr

import environ
from django.conf.locale import LANG_INFO
from django.utils.translation import gettext_lazy as _

import umap as project_module

env = environ.Env()

# =============================================================================
# Generic Django project settings
# =============================================================================


INTERNAL_IPS = env.list("INTERNAL_IPS", default=["127.0.0.1"])
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["*"])
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
ADMINS = tuple(parseaddr(email) for email in env.list("ADMINS", default=[]))
ASGI_APPLICATION = "umap.asgi.application"

DEBUG = env.bool("DEBUG", default=False)

SITE_ID = 1
# Add languages we're missing from Django
LANG_INFO.update(
    {
        "am-et": {
            "bidi": False,
            "name": "Amharic",
            "code": "am-et",
            "name_local": "አማርኛ",
        },
        "zh": {
            "bidi": False,
            "code": "zh",
            "name": "Chinese",
            "name_local": "简体中文",
        },
        "si": {
            "bidi": False,
            "code": "si",
            "name": "Sinhala",
            "name_local": "සිංහල",
        },
        "ms": {
            "bidi": False,
            "code": "ms",
            "name": "Malay",
            "name_local": "Bahasa Melayu",
        },
        "fa-ir": {
            "bidi": True,
            "code": "fa-ir",
            "name": "Persian (Iran)",
            "name_local": "فارسی",
        },
    }
)
# Local time zone for this installation. Choices can be found here:
# http://en.wikipedia.org/wiki/List_of_tz_zones_by_name
TIME_ZONE = "UTC"
USE_TZ = True
USE_I18N = True
LANGUAGE_CODE = "en"
LANGUAGES = (
    ("am-et", "Amharic"),
    ("ar", "Arabic"),
    ("ast", "Asturian"),
    ("bg", "Bulgarian"),
    ("br", "Breton"),
    ("ca", "Catalan"),
    ("cs-cz", "Czech"),
    ("da", "Danish"),
    ("de", "German"),
    ("el", "Greek"),
    ("en", "English"),
    ("es", "Spanish"),
    ("et", "Estonian"),
    ("eu", "Basque"),
    ("fa-ir", "Persian (Iran)"),
    ("fi", "Finnish"),
    ("fr", "French"),
    ("gl", "Galician"),
    ("he", "Hebrew"),
    ("hr", "Croatian"),
    ("hu", "Hungarian"),
    ("id", "Indonesian"),
    ("is", "Icelandic"),
    ("it", "Italian"),
    ("ja", "Japanese"),
    ("ko", "Korean"),
    ("lt", "Lithuanian"),
    ("ms", "Malay"),
    ("nl", "Dutch"),
    ("no", "Norwegian"),
    ("pl", "Polish"),
    ("pt", "Portuguese"),
    ("pt-br", "Portuguese (Brazil)"),
    ("pt-pt", "Portuguese (Portugal)"),
    ("ro", "Romanian"),
    ("ru", "Russian"),
    ("si", "Sinhala"),
    ("sk-sk", "Slovak"),
    ("sl", "Slovenian"),
    ("sr", "Serbian"),
    ("sv", "Swedish"),
    ("th-th", "Thai (Thailand)"),
    ("tr", "Turkish"),
    ("uk-ua", "Ukrainian"),
    ("vi", "Vietnamese"),
    ("zh", "Chinese"),
    ("zh-tw", "Chinese (Taiwan)"),
)

# Make this unique, and don't share it with anybody.
SECRET_KEY = env("SECRET_KEY", default=None)

INSTALLED_APPS = (
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.sites",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.admin",
    "django.contrib.gis",
    "django_probes",
    "umap",
    "social_django",
    # See https://github.com/peopledoc/django-agnocomplete/commit/26eda2dfa4a2f8a805ca2ea19a0c504b9d773a1c
    # Django does not find the app config in the default place, so the app is not loaded
    # so the "autodiscover" is not run.
    "agnocomplete.app.AgnocompleteConfig",
)
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = None
# https://docs.djangoproject.com/en/4.2/releases/4.1/#forms
FORM_RENDERER = "django.forms.renderers.DjangoTemplates"

# =============================================================================
# Calculation of directories relative to the project module location
# =============================================================================


PROJECT_DIR = os.path.dirname(os.path.realpath(project_module.__file__))

# =============================================================================
# Project URLS and media settings
# =============================================================================

ROOT_URLCONF = "umap.urls"
WSGI_APPLICATION = "umap.wsgi.application"

LOGIN_URL = "/login/"
LOGOUT_URL = "/logout/"
LOGIN_REDIRECT_URL = "login_popup_end"

STATIC_URL = "/static/"
MEDIA_URL = "/uploads/"

STATIC_ROOT = env("STATIC_ROOT", default=os.path.join("static"))
MEDIA_ROOT = env("MEDIA_ROOT", default=os.path.join("uploads"))

STATICFILES_FINDERS = [
    "django.contrib.staticfiles.finders.FileSystemFinder",
    "django.contrib.staticfiles.finders.AppDirectoriesFinder",
]
STATICFILES_DIRS = []  # May be extended when using UMAP_CUSTOM_STATICS
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "data": {
        "BACKEND": "umap.storage.fs.FSDataStorage",
    },
    "staticfiles": {
        "BACKEND": "umap.storage.staticfiles.UmapManifestStaticFilesStorage",
    },
}
# Add application/json and application/geo+json to default django-storages setting
# in order to gzip our datalayers geojson files.
GZIP_CONTENT_TYPES = [
    "text/css",
    "text/javascript",
    "application/javascript",
    "application/x-javascript",
    "image/svg+xml",
    "application/json",
    "application/geo+json",
]


# =============================================================================
# Templates
# =============================================================================

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": (
                "django.contrib.auth.context_processors.auth",
                "django.template.context_processors.debug",
                "django.template.context_processors.i18n",
                "django.template.context_processors.request",
                "django.template.context_processors.media",
                "django.template.context_processors.static",
                "django.template.context_processors.tz",
                "django.contrib.messages.context_processors.messages",
                "social_django.context_processors.backends",
                "social_django.context_processors.login_redirect",
                "umap.context_processors.settings",
                "umap.context_processors.version",
            )
        },
    },
]


# =============================================================================
# Middleware
# =============================================================================

MIDDLEWARE = (
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "umap.middleware.readonly_middleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "umap.middleware.deprecated_auth_backend",
)


# =============================================================================
# Auth / security
# =============================================================================

# Set to True if login into django account should be possible. Default is to
# only use OAuth flow.
ENABLE_ACCOUNT_LOGIN = env.bool("ENABLE_ACCOUNT_LOGIN", default=False)
USER_DISPLAY_NAME = "{username}"
# For use by Agnocomplete
# See https://django-agnocomplete.readthedocs.io/en/latest/autocomplete-definition.html#agnocompletemode
USER_AUTOCOMPLETE_FIELDS = ["^username"]
USER_URL_FIELD = "username"

# =============================================================================
# Miscellaneous project settings
# =============================================================================
UMAP_ALLOW_ANONYMOUS = env.bool("UMAP_ALLOW_ANONYMOUS", default=False)
UMAP_ALLOW_EDIT_PROFILE = env.bool("UMAP_ALLOW_EDIT_PROFILE", default=True)

UMAP_EXTRA_URLS = {
    "routing": "http://www.openstreetmap.org/directions?engine=osrm_car&route={lat},{lng}&locale={locale}#map={zoom}/{lat}/{lng}",  # noqa
    "ajax_proxy": "/ajax-proxy/?url={url}&ttl={ttl}",
    "search": "https://photon.komoot.io/api/?",
    "edit_in_osm": "https://www.openstreetmap.org/edit#map={zoom}/{lat}/{lng}",
}
UMAP_KEEP_VERSIONS = env.int("UMAP_KEEP_VERSIONS", default=10)
SITE_URL = env("SITE_URL", default="http://umap.org")
SHORT_SITE_URL = env("SHORT_SITE_URL", default=None)
SITE_NAME = "uMap"
SITE_DESCRIPTION = "Online map creator"
UMAP_DEMO_SITE = env("UMAP_DEMO_SITE", default=False)
UMAP_EXCLUDE_DEFAULT_MAPS = False
UMAP_MAPS_PER_PAGE = 5
UMAP_MAPS_PER_SEARCH = 25
UMAP_MAPS_PER_PAGE_OWNER = 10
UMAP_SEARCH_CONFIGURATION = "simple"
UMAP_HELP_URL = "https://discover.umap-project.org/"
UMAP_HELP_LINKS = [
    {
        "label": _("uMap user documentation"),
        "url": "https://discover.umap-project.org/",
        "lang": "en/fr",
    },
    {
        "label": _("Video tutorials"),
        "url": "https://discover.umap-project.org/videos/",
        "lang": "en/fr",
    },
    {
        "label": _("OpenStreetMap.org forum"),
        "url": "https://community.openstreetmap.org/tag/umap",
        "lang": "en/de",
    },
    {
        "label": _("OpenStreetMap France forum"),
        "url": "https://forum.openstreetmap.fr/c/utiliser/umap/29",
        "lang": "fr",
    },
]
USER_MAPS_URL = "user_maps"
DATABASES = {
    "default": env.db(
        default="postgis://localhost:5432/umap",
        engine="django.contrib.gis.db.backends.postgis",
    )
}
UMAP_DEFAULT_SHARE_STATUS = None
UMAP_DEFAULT_EDIT_STATUS = None
UMAP_DEFAULT_FEATURES_HAVE_OWNERS = False
UMAP_HOME_FEED = "latest"
UMAP_IMPORTERS = {}
UMAP_HOST_INFOS = {}
UMAP_LABEL_KEYS = ["name", "title"]
UMAP_TAGS = (
    ("arts", _("Art and Culture")),
    ("cycling", _("Cycling")),
    ("business", _("Business")),
    ("environment", _("Environment")),
    ("education", _("Education")),
    ("food", _("Food and Agriculture")),
    ("geopolitics", _("Geopolitics")),
    ("health", _("Health")),
    ("hiking", _("Hiking")),
    ("history", _("History")),
    ("public", _("Public sector")),
    ("science", _("Science")),
    ("shopping", _("Shopping")),
    ("sport", _("Sport and Leisure")),
    ("travel", _("Travel")),
    ("transports", _("Transports")),
    ("tourism", _("Tourism")),
)

UMAP_READONLY = env("UMAP_READONLY", default=False)
UMAP_GZIP = True
LOCALE_PATHS = [os.path.join(PROJECT_DIR, "locale")]

LEAFLET_LONGITUDE = env.int("LEAFLET_LONGITUDE", default=2)
LEAFLET_LATITUDE = env.int("LEAFLET_LATITUDE", default=51)
LEAFLET_ZOOM = env.int("LEAFLET_ZOOM", default=6)
UMAP_PICTOGRAMS_COLLECTIONS = {}


# =============================================================================
# Third party app settings
# =============================================================================
LOGIN_URL = "login"
SOCIAL_AUTH_LOGIN_REDIRECT_URL = "/login/popup/end/"

AUTHENTICATION_BACKENDS = ()
DEPRECATED_AUTHENTICATION_BACKENDS = []

SOCIAL_AUTH_OPENSTREETMAP_OAUTH2_KEY = env(
    "SOCIAL_AUTH_OPENSTREETMAP_OAUTH2_KEY", default=""
)
SOCIAL_AUTH_OPENSTREETMAP_OAUTH2_SECRET = env(
    "SOCIAL_AUTH_OPENSTREETMAP_OAUTH2_SECRET", default=""
)
if SOCIAL_AUTH_OPENSTREETMAP_OAUTH2_KEY and SOCIAL_AUTH_OPENSTREETMAP_OAUTH2_SECRET:
    AUTHENTICATION_BACKENDS += (
        "social_core.backends.openstreetmap_oauth2.OpenStreetMapOAuth2",
    )

AUTHENTICATION_BACKENDS += ("django.contrib.auth.backends.ModelBackend",)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "level": "ERROR",
            "filters": None,
            "class": "logging.StreamHandler",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "ERROR",
        },
    },
}

# Real-time editing configuration

REALTIME_ENABLED = env.bool("REALTIME_ENABLED", default=False)

REDIS_URL = env("REDIS_URL", default="redis://localhost:6379")

OPENROUTESERVICE_APIKEY = env("OPENROUTESERVICE_APIKEY", default=None)
