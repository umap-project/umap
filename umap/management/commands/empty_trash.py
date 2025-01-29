from datetime import datetime, timedelta

from django.core.management.base import BaseCommand

from umap.models import DataLayer, Map


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
        since = (datetime.utcnow() - timedelta(days=days)).date()
        print(f"Deleting map in trash since {since}")
        maps = Map.objects.filter(share_status=Map.DELETED, modified_at__lt=since)
        for map in maps:
            map_id = map.id
            map_name = map.name
            trashed_at = map.modified_at.date()
            if not options["dry_run"]:
                map.delete()
            print(f"Deleted map {map_name} ({map_id}), trashed at {trashed_at}")
        print(f"Deleting layers in trash since {since}")
        layers = DataLayer.objects.filter(
            share_status=DataLayer.DELETED, modified_at__lt=since
        )
        for layer in layers:
            layer_id = layer.uuid
            layer_name = layer.name
            trashed_at = layer.modified_at.date()
            if not options["dry_run"]:
                layer.delete()
            print(f"Deleted layer {layer_name} ({layer_id}), trashed at {trashed_at}")
