import sys
from datetime import datetime, timedelta

from django.conf import settings
from django.core.management.base import BaseCommand

from umap.models import DataLayer


class Command(BaseCommand):
    help = "Delete versions from datalayers which last modified date is x days ago. Eg.: umap purge_old_versions --days-ago 30"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days-ago",
            help="Select datalayers which where last modified that many days ago",
            default=360,
            type=int,
        )
        parser.add_argument(
            "--days-to-select",
            help="How many days before `days-ago` to consider",
            default=1,
            type=int,
        )
        parser.add_argument(
            "--dry-run",
            help="Pretend to delete but just report",
            action="store_true",
        )

    def handle(self, *args, **options):
        if settings.STORAGES["data"]["BACKEND"] != "umap.storage.fs.FSDataStorage":
            msg = (
                "This command is only available for filesystem storage. "
                "For S3 storage, use lifecycle rule in the bucket."
            )
            sys.exit(msg)
        end = (datetime.utcnow() - timedelta(days=options["days_ago"] - 1)).date()
        print(f"Deleting versions for datalayer unmodified since {end}")
        filters = {"modified_at__lt": end}
        if options["days_to_select"]:
            start = end - timedelta(days=options["days_to_select"])
            filters = {"modified_at__date__range": [start, end]}
        datalayers = DataLayer.objects.filter(**filters)
        print(f"Selected {len(datalayers)} datalayers")
        total_deleted = 0
        for layer in datalayers:
            layer_id = layer.uuid
            layer_name = layer.name
            last_modified = layer.modified_at.date()
            deleted = layer.geojson.storage.purge_old_versions(
                layer, keep=1, dry_run=options["dry_run"]
            )
            total_deleted += deleted
            if not options["dry_run"]:
                layer.geojson.storage.purge_gzip(layer)
            if (deleted and options["verbosity"] > 0) or options["verbosity"] > 1:
                print(
                    f"Deleted {deleted} old versions of `{layer_name}` ({layer_id}), unmodified since {last_modified}"
                )
        if not options["dry_run"]:
            print(f"Successfully deleted {total_deleted} geojson files.")
        else:
            print(f"The command would delete {total_deleted} geojson files.")
