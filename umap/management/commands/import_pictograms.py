import os

from django.core.files import File
from django.core.management.base import BaseCommand

from umap.models import Pictogram


class Command(BaseCommand):
    help = 'Import pictograms from a folder'

    def add_arguments(self, parser):
        parser.add_argument('path')
        parser.add_argument('--attribution', required=True,
                            help='Attribution of the imported pictograms')
        parser.add_argument('--suffix',
                            help='Optionnal suffix to add to each name')
        parser.add_argument('--force', action='store_true',
                            help='Update picto if it already exists.')

    def handle(self, *args, **options):
        path = options['path']
        attribution = options['attribution']
        suffix = options['suffix']
        force = options['force']
        for filename in os.listdir(path):
            if filename.endswith("-24.png"):
                name = self.extract_name(filename)
                if suffix:
                    name = '{name}{suffix}'.format(name=name, suffix=suffix)
                picto = Pictogram.objects.filter(name=name).last()
                if picto:
                    if not force:
                        self.stdout.write(u"⚠ Pictogram with name '{name}' already exists. Skipping.".format(name=name))  # noqa
                        continue
                else:
                    picto = Pictogram()
                    picto.name = name
                filepath = os.path.join(path, filename)
                with open(filepath, 'rb') as f:
                    picto.attribution = attribution
                    picto.pictogram.save(filename, File(f), save=True)
                    self.stdout.write(u"✔ Imported pictogram {filename}.".format(filename=filename))  # noqa

    def extract_name(self, filename):
        return filename[:-7].replace('-', ' ')
