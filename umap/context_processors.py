from django.conf import settings

from . import __version__

def feedback_link(request):
    return {
        'UMAP_FEEDBACK_LINK': settings.UMAP_FEEDBACK_LINK
    }

def version(request):
    return {
        'UMAP_VERSION': __version__
    }

def authentication(request):
    return {
        'ENABLE_ACCOUNT_LOGIN': settings.ENABLE_ACCOUNT_LOGIN
    }
