import sys

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import translation

from umap.models import Map


class Command(BaseCommand):
    help = (
        "Retrieve anonymous edit url of a map. "
        "Eg.: python manage.py anonymous_edit_url 1234"
    )

    def add_arguments(self, parser):
        parser.add_argument("pk", help="PK of the map to retrieve.")
        parser.add_argument(
            "--lang",
            help="Language code to use in the URL.",
            default=settings.LANGUAGE_CODE,
        )

    def abort(self, msg):
        self.stderr.write(msg)
        sys.exit(1)

    def handle(self, *args, **options):
        translation.activate(options["lang"])
        pk = options["pk"]
        try:
            map_ = Map.objects.get(pk=pk)
        except Map.DoesNotExist:
            self.abort("Map with pk {} not found".format(pk))
        if map_.owner:
            self.abort("Map is not anonymous (owner: {})".format(map_.owner))
        print(map_.get_anonymous_edit_url())
