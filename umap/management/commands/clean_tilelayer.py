import json
import sys

from django.core.management.base import BaseCommand
from django.db import connection
from psycopg.types.json import Jsonb

from umap.models import Map, TileLayer


class Command(BaseCommand):
    help = """Clean tilelayer in database

    This will simply replace the URL in maps settings:
    umap clean_tilelayer http://my.old/url/template http://my.new/url/template

    This will replace the whole tilelayer in maps settings by the one with this name:
    umap clean_tilelayer http://my.old/url/template "some string"

    This will replace the whole tilelayer in maps settings by the one with this id:
    umap clean_tilelayer http://my.old/url/template an_id

    This will delete the whole tilelayer from maps settings:
    umap clean_tilelayer http://my.old/url/template

    To get the available tilelayers in db (available for users):
    umap clean_tilelayer --available

    To get statistics of tilelayers usage in db (including custom ones):
    umap clean_tilelayer --available
    """

    def add_arguments(self, parser):
        parser.add_argument("old", nargs="?", help="url template we want to clean")
        parser.add_argument(
            "new", help="what to replace this tilelayer with", nargs="?"
        )
        parser.add_argument(
            "--no-input", action="store_true", help="Do not ask for confirm."
        )
        parser.add_argument(
            "--available", action="store_true", help="List known tilelayers."
        )
        parser.add_argument(
            "--stats", action="store_true", help="Display stats on tilelayer usage."
        )

    def handle(self, *args, **options):
        self.no_input = options["no_input"]
        if options["available"]:
            self.list_available()
            sys.exit()
        if options["stats"]:
            self.stats()
            sys.exit()
        old = options["old"]
        new = options["new"]
        if not old:
            sys.exit("⚠ You must define an url_template")

        count = Map.objects.filter(
            settings__properties__tilelayer__url_template=old
        ).count()
        if not count:
            self.stdout.write("⚠ No map found. Exiting.")
            sys.exit()
        self.stdout.write(f"{count} maps found.")
        if not new:
            self.delete(old)
        elif new.startswith("http"):
            self.replace_url(old, new)
        else:
            # Let's consider it's a name or an id
            self.replace_tilelayer(old, new)

    def confirm(self, message):
        if self.no_input:
            return True
        result = input("%s (y/N) " % message) or "n"
        if not result[0].lower() == "y":
            self.stdout.write("⚠ Action cancelled.")
            sys.exit()
        return True

    def delete(self, old):
        if self.confirm(
            "Are you sure you want to delete the tilelayer key from all those "
            "maps settings ?"
        ):
            with connection.cursor() as cursor:
                ret = cursor.execute(
                    "UPDATE umap_map "
                    "SET settings['properties'] = (settings->'properties') - 'tilelayer'"
                    "WHERE settings->'properties'->'tilelayer'->'url_template' = %s",
                    [Jsonb(old)],
                )
            self.stdout.write(f"✔ Deleted {old} from {ret.rowcount} maps.")

    def replace_url(self, old, new):
        if self.confirm(
            f"Are you sure you want to replace '{old}'' by '{new}'' from all those "
            "map settings ?"
        ):
            with connection.cursor() as cursor:
                ret = cursor.execute(
                    "UPDATE umap_map "
                    "SET settings['properties']['tilelayer']['url_template'] = %s "
                    "WHERE settings->'properties'->'tilelayer'->'url_template' = %s",
                    [Jsonb(new), Jsonb(old)],
                )
            self.stdout.write(f"✔ Replaced {old} by {new} in {ret.rowcount} maps.")

    def replace_tilelayer(self, old, new):
        try:
            tilelayer = TileLayer.objects.get(name=new)
        except TileLayer.DoesNotExist:
            try:
                tilelayer = TileLayer.objects.get(id=new)
            except (TileLayer.DoesNotExist, ValueError):
                sys.exit(f"⚠ Cannot find a TileLayer with name or id = '{new}'.")
        if self.confirm(
            f"Are you sure you want to replace {old} by '{tilelayer.name}' "
            "from all those map settings ?"
        ):
            with connection.cursor() as cursor:
                ret = cursor.execute(
                    "UPDATE umap_map "
                    "SET settings['properties']['tilelayer'] = %s "
                    "WHERE settings->'properties'->'tilelayer'->'url_template' = %s",
                    [Jsonb(tilelayer.json), Jsonb(old)],
                )
            self.stdout.write(
                f"✔ Replaced {old} by {tilelayer.name} in {ret.rowcount} maps."
            )

    def list_available(self):
        tilelayers = TileLayer.objects.all()
        for tilelayer in tilelayers:
            print(f"{tilelayer.pk} '{tilelayer.name}' {tilelayer.url_template}")

    def stats(self):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) as count, "
                "settings->'properties'->'tilelayer'->'url_template' as url "
                "FROM umap_map "
                "GROUP BY settings->'properties'->'tilelayer'->'url_template' "
                "ORDER BY count DESC"
            )
            res = cursor.fetchall()
        for count, url in res:
            print(f"{count}\t{url}")
