from pathlib import Path

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.core.management.base import BaseCommand

from umap.models import DataLayer, Pictogram
from umap.storage.fs import FSDataStorage


class Command(BaseCommand):
    help = "Migrate latest datalayers or pictograms from filesystem to S3."

    def add_arguments(self, parser):
        parser.add_argument(
            "--pictograms",
            help="Migrate pictograms instead of datalayers",
            action="store_true",
        )

    def handle(self, *args, **options):
        if options["pictograms"]:
            assert (
                settings.STORAGES["default"]["BACKEND"]
                == "storages.backends.s3.S3Storage"
            ), "You must configure your default storage to point to S3"
            fs_storage = FileSystemStorage()
            for picto in Pictogram.objects.all():
                fs_path = str(picto.pictogram)
                picto.pictogram.save(
                    Path(picto.pictogram.name).name, fs_storage.open(fs_path)
                )
                if options["verbosity"] > 1:
                    print("Migrated:", fs_path)
        else:
            assert settings.UMAP_READONLY, (
                "You must run that script with a read-only uMap."
            )
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
