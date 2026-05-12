from django.apps import AppConfig


class UmapConfig(AppConfig):
    name = "umap"
    verbose_name = "uMap"

    def ready(self):
        from . import checks  # noqa: F401  (registers system checks)
