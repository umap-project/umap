import os
from pathlib import Path

from django.conf import settings
from django.core.checks import Error, register


@register()
def check_ajax_proxy_cache_dir(app_configs, **kwargs):
    errors = []
    cache_dir = settings.AJAX_PROXY_CACHE_DIR
    if cache_dir is None:
        errors.append(
            Error(
                "AJAX_PROXY_CACHE_DIR is not set.",
                hint="Set it to a writable directory in your settings.",
                id="umap.E001",
            )
        )
    elif not Path(cache_dir).is_dir():
        errors.append(
            Error(
                f"AJAX_PROXY_CACHE_DIR ({cache_dir!r}) is not an existing directory.",
                id="umap.E002",
            )
        )
    elif not os.access(cache_dir, os.W_OK):
        errors.append(
            Error(
                f"AJAX_PROXY_CACHE_DIR ({cache_dir!r}) is not writable.",
                id="umap.E003",
            )
        )
    return errors
