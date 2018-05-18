import sys

from django.core.management.base import BaseCommand
from django.conf import settings

from umap.models import Map


class Command(BaseCommand):
    help = ('Retrieve anonymous edit url of a map. '
            'Eg.: python manage.py anonymous_edit_url 1234')

    def add_arguments(self, parser):
        parser.add_argument('pk', help='PK of the map to retrieve.')

    def abort(self, msg):
        self.stderr.write(msg)
        sys.exit(1)

    def handle(self, *args, **options):
        pk = options['pk']
        try:
            map_ = Map.objects.get(pk=pk)
        except Map.DoesNotExist:
            self.abort('Map with pk {} not found'.format(pk))
        if map_.owner:
            self.abort('Map is not anonymous (owner: {})'.format(map_.owner))
        print(settings.SITE_URL + map_.get_anonymous_edit_url())
