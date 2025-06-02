import sys
from datetime import datetime, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand

from umap.models import DataLayer


class Command(BaseCommand):
    help = "Delete versions from datalayers which last modified date is x days ago. Eg.: umap prune_old_versions --days 30"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            help="Number of days to consider datalayers for versions removal",
            default=360,
            type=int,
        )
        parser.add_argument(
            "--dry-run",
            help="Pretend to delete but just report",
            action="store_true",
        )
        parser.add_argument(
            "--initial",
            help="To be added at first run: also select older layers",
            action="store_true",
        )

    def handle(self, *args, **options):
        if settings.STORAGES["data"]["BACKEND"] != "umap.storage.fs.FSDataStorage":
            msg = (
                "This command is only available for filesystem storage. "
                "For S3 storage, use lifecycle rule in the bucket."
            )
            sys.exit(msg)
        days = options["days"]
        since = (datetime.utcnow() - timedelta(days=days)).date()
        print(f"Deleting versions for datalayer unmodified since {since}")
        filters = {"modified_at__date": since}
        if options["initial"]:
            filters = {"modified_at__lt": since}
        datalayers = DataLayer.objects.filter(**filters)
        print(f"Selected {len(datalayers)} datalayers")
        total_deleted = 0
        for layer in datalayers:
            layer_id = layer.uuid
            layer_name = layer.name
            last_modified = layer.modified_at.date()
            deleted = 0
            if not options["dry_run"]:
                deleted = layer.geojson.storage.purge_old_versions(layer, keep=1)
                layer.geojson.storage.purge_gzip(layer)
                total_deleted += deleted
            print(
                f"Deleted {deleted} old versions of `{layer_name}` ({layer_id}), unmodified since {last_modified}"
            )
        if not options["dry_run"]:
            print(f"Successfully deleted {total_deleted} geojson files.")
        else:
            print(f"The command would delete {total_deleted} geojson files.")
