from django.conf import settings
from django.core.management.base import BaseCommand

from umap.models import DataLayer
from umap.storage.fs import FSDataStorage


class Command(BaseCommand):
    help = "Migrate latest datalayers from filesystem to S3."

    def handle(self, *args, **options):
        assert settings.UMAP_READONLY, "You must run that script with a read-only uMap."
        assert (
            settings.STORAGES["data"]["BACKEND"] == "umap.storage.s3.S3DataStorage"
        ), "You must configure your storages to point to S3"
        fs_storage = FSDataStorage()
        for datalayer in DataLayer.objects.all():
            geojson_fs_path = str(datalayer.geojson)
            try:
                datalayer.geojson.save(
                    datalayer.geojson.name, fs_storage.open(geojson_fs_path)
                )
            except FileNotFoundError as e:
                print(e)
                print(geojson_fs_path, "not found on disk")
                continue
            if options["verbosity"] > 1:
                print("Migrated:", geojson_fs_path)
            datalayer.save(force_update=True)
