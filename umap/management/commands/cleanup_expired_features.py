import logging
import time

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand
from django.db import close_old_connections

from umap.feature_timing import cleanup_layer
from umap.models import DataLayer, Map

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Delete or archive due features. Run periodically; dates use midnight UTC."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument(
            "--loop",
            action="store_true",
            help="Repeat every 60 seconds (requires process supervision).",
        )

    def handle(self, *args, **options):
        while True:
            count = 0
            layers = DataLayer.objects.exclude(share_status=DataLayer.DELETED).exclude(
                map__share_status=Map.DELETED
            )
            for pk in layers.values_list("pk", flat=True).iterator():
                try:
                    count += cleanup_layer(pk, dry_run=options["dry_run"])
                except (
                    ValidationError,
                    ValueError,
                    OSError,
                    DataLayer.DoesNotExist,
                    Map.DoesNotExist,
                ):
                    logger.exception(
                        "Cannot process layer %s; leaving it unchanged", pk
                    )
            self.stdout.write(
                f"{'Due' if options['dry_run'] else 'Processed'} features: {count}"
            )
            if not options["loop"]:
                return
            close_old_connections()
            time.sleep(60)
