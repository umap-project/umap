from django.conf import settings
from django.contrib.postgres.search import SearchQuery, SearchVector
from django.core.management.base import BaseCommand

from umap.models import Map

vector = SearchVector("name", config=settings.UMAP_SEARCH_CONFIGURATION)


def confirm(prompt):
    return input(f"{prompt} [Y/n]").upper() in ["", "Y"]


class Command(BaseCommand):
    help = "Search maps and delete, block or restore them."

    def add_arguments(self, parser):
        parser.add_argument("search", help="Actual search.")
        parser.add_argument(
            "--dry-run",
            help="Do not make actions, just display",
            action="store_true",
        )
        parser.add_argument(
            "--delete",
            help="Mark maps as deleted",
            action="store_true",
        )
        parser.add_argument(
            "--restore",
            help="Restore delete maps in the search results",
            action="store_true",
        )
        parser.add_argument(
            "--block",
            help="Block maps in the search results",
            action="store_true",
        )
        parser.add_argument(
            "--public",
            help="Search only public maps",
            action="store_true",
        )
        parser.add_argument(
            "--no-input", action="store_true", help="Do not ask for confirm."
        )

    def confirm(self, message):
        result = "n"
        if not self.dry_run:
            if self.no_input:
                return True
            result = input("%s (y/N) " % message) or "n"
        if result[0].lower() != "y":
            self.stdout.write("⚠ Action cancelled.")
            return False
        return True

    def handle(self, *args, **options):
        self.dry_run = options["dry_run"]
        self.no_input = options["no_input"]
        query = SearchQuery(
            options["search"],
            config=settings.UMAP_SEARCH_CONFIGURATION,
            search_type="websearch",
        )
        qs = Map.public.all() if options["public"] else Map.objects.all()
        qs = qs.annotate(search=vector).filter(search=query)
        for mm in qs:
            row = [
                mm.pk,
                mm.name[:50],
                str(mm.owner or "")[:10],
                mm.get_share_status_display(),
                settings.SITE_URL + mm.get_absolute_url(),
            ]
            print("{:1} | {:<50} | {:<10} | {:<20} | {}".format(*row))
        if options["delete"] and self.confirm(f"Delete {qs.count()} maps?"):
            for mm in qs:
                mm.move_to_trash()
            print("Done!")
        elif options["restore"]:
            to_restore = [mm for mm in qs if mm.share_status == Map.DELETED]
            if self.confirm(f"Restore {len(to_restore)} maps?"):
                for mm in to_restore:
                    mm.share_status = Map.DRAFT
                    mm.save()
                print("Done!")
        elif options["block"] and self.confirm(f"Block {qs.count()} maps?"):
            for mm in qs:
                mm.share_status = Map.BLOCKED
                mm.save()
            print("Done!")
