from django.conf import settings as djsettings

from . import __version__


def settings(request):
    return {
        'UMAP_FEEDBACK_LINK': djsettings.UMAP_FEEDBACK_LINK,
        'SITE_NAME': djsettings.SITE_NAME,
        'ENABLE_ACCOUNT_LOGIN': djsettings.ENABLE_ACCOUNT_LOGIN,
    }


def version(request):
    return {
        'UMAP_VERSION': __version__
    }
