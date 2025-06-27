import shutil
import sys
from pathlib import Path

from django.core.management.base import BaseCommand

from umap.models import Pictogram


class Command(BaseCommand):
    help = "Export pictogram to some given folder."

    def add_arguments(self, parser):
        parser.add_argument("dest", help="Destination folder to export pictograms")

    def handle(self, *args, **options):
        dest = Path(options["dest"])
        if not dest.exists():
            sys.exit("Destination does not exist", dest)

        for picto in Pictogram.objects.all():
            parent = dest
            if picto.category:
                parent = parent / picto.category.replace("/", "-")
                parent.mkdir(exist_ok=True)
            path = parent / Path(picto.pictogram.name).name
            shutil.copy2(picto.pictogram.path, path)
            if options["verbosity"] > 1:
                print("Copied", picto.pictogram.path, "to", path)
