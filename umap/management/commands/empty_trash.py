from datetime import datetime, timedelta

from django.core.management.base import BaseCommand

from umap.models import Map


class Command(BaseCommand):
    help = "Remove maps in trash. Eg.: umap empty_trash --days 7"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            help="Number of days to consider maps for removal",
            default=30,
            type=int,
        )
        parser.add_argument(
            "--dry-run",
            help="Pretend to delete but just report",
            action="store_true",
        )

    def handle(self, *args, **options):
        days = options["days"]
        since = datetime.utcnow() - timedelta(days=days)
        print(f"Deleting map in trash since {since}")
        maps = Map.objects.filter(share_status=Map.DELETED, modified_at__lt=since)
        for map in maps:
            if not options["dry_run"]:
                map.delete()
            print(f"Deleted map {map.name} ({map.id}), trashed on {map.modified_at}")
