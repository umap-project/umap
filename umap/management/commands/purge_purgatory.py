import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Remove old files from purgatory. Eg.: umap purge_purgatory --days 7"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            help="Number of days to consider files for removal",
            default=30,
            type=int,
        )

    def handle(self, *args, **options):
        days = options["days"]
        root = Path(settings.UMAP_PURGATORY_ROOT)
        threshold = time.time() - days * 86400
        for path in root.iterdir():
            stats = path.stat()
            filestamp = stats.st_mtime
            if filestamp < threshold:
                path.unlink()
                print(f"Removed old file {path}")
