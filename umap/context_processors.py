from django.conf import settings as djsettings

from . import __version__


def settings(request):
    return {
        'UMAP_FEEDBACK_LINK': djsettings.UMAP_FEEDBACK_LINK,
        'SITE_NAME': djsettings.SITE_NAME
    }


def version(request):
    return {
        'UMAP_VERSION': __version__
    }

def authentication(request):
    return {
        'ENABLE_ACCOUNT_LOGIN': settings.ENABLE_ACCOUNT_LOGIN
    }
