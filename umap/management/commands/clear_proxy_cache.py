import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = (
        "Remove ajax proxy cache entries older than --max-age seconds. "
        "Safe to run while the server is up."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--max-age",
            type=int,
            default=86400,
            help="Delete entries with mtime older than this many seconds "
            "(default: 86400, i.e. the longest allowed TTL).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List entries that would be deleted without removing them.",
        )

    def handle(self, *args, **options):
        cache_dir = Path(settings.AJAX_PROXY_CACHE_DIR)
        cutoff = time.time() - options["max_age"]
        dry_run = options["dry_run"]

        deleted = 0
        kept = 0
        for path in cache_dir.glob("umap_*"):
            # Only match the cache files and stale semaphores we own; the
            # in-flight tempfiles (umap_*.cache.<random>) are skipped.
            if path.suffix not in (".cache", ".tmp"):
                continue
            try:
                mtime = path.stat().st_mtime
            except FileNotFoundError:
                continue
            if mtime >= cutoff:
                kept += 1
                continue
            if dry_run:
                self.stdout.write(f"Would delete: {path}")
            else:
                path.unlink(missing_ok=True)
                self.stdout.write(f"Deleted: {path}")
            deleted += 1
        self.stdout.write(self.style.SUCCESS(f"Done: {deleted} deleted, {kept} kept."))
