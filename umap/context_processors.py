from django.conf import settings as djsettings

from . import VERSION


def settings(request):
    return {
        "UMAP_HELP_URL": djsettings.UMAP_HELP_URL,
        "SITE_NAME": djsettings.SITE_NAME,
        "SITE_DESCRIPTION": djsettings.SITE_DESCRIPTION,
        "SITE_URL": djsettings.SITE_URL,
        "ENABLE_ACCOUNT_LOGIN": djsettings.ENABLE_ACCOUNT_LOGIN,
        "UMAP_READONLY": djsettings.UMAP_READONLY,
        "UMAP_DEMO_SITE": djsettings.UMAP_DEMO_SITE,
        "UMAP_HOST_INFOS": djsettings.UMAP_HOST_INFOS,
        "UMAP_ALLOW_EDIT_PROFILE": djsettings.UMAP_ALLOW_EDIT_PROFILE,
        "UMAP_TAGS": djsettings.UMAP_TAGS,
    }


def version(request):
    return {"UMAP_VERSION": VERSION}
