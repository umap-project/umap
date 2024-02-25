from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand

from umap.models import Pictogram


class Command(BaseCommand):
    help = "Import pictograms from a folder"

    def add_arguments(self, parser):
        parser.add_argument("path")
        parser.add_argument(
            "--attribution",
            required=True,
            help="Attribution of the imported pictograms",
        )
        parser.add_argument(
            "--extensions",
            help="Optional list of extensins to process",
            nargs="+",
            default=[".svg"],
        )
        parser.add_argument(
            "--exclude",
            help="Optional list of files or dirs to exclude",
            nargs="+",
            default=["font"],
        )
        parser.add_argument(
            "--force", action="store_true", help="Update picto if it already exists."
        )

    def handle(self, *args, **options):
        self.path = Path(options["path"])
        self.attribution = options["attribution"]
        self.extensions = options["extensions"]
        self.force = options["force"]
        self.exclude = options["exclude"]
        self.handle_directory(self.path)

    def handle_directory(self, path):
        for filename in path.iterdir():
            if filename.name in self.exclude:
                continue
            if filename.is_dir():
                self.handle_directory(filename)
                continue
            if filename.suffix in self.extensions:
                name = filename.stem
                picto = Pictogram.objects.filter(name=name).last()
                if picto:
                    if not self.force:
                        self.stdout.write(
                            f"⚠ Pictogram with name '{name}' already exists. Skipping."
                        )
                        continue
                else:
                    picto = Pictogram()
                    picto.name = name
                if path.name != self.path.name:  # Subfolders only
                    picto.category = path.name
                picto.attribution = self.attribution
                with (filename).open("rb") as f:
                    picto.pictogram.save(filename.name, File(f), save=True)
                self.stdout.write(f"✔ Imported pictogram {filename}.")
