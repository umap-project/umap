import io
import os
from pathlib import Path

from django.core.management.base import BaseCommand
from django.conf import settings
from django.contrib.staticfiles import finders
from django.template.loader import render_to_string
from django.utils.translation import to_locale

ROOT = Path(settings.PROJECT_DIR) / 'static/umap/locale/'


class Command(BaseCommand):

    def handle(self, *args, **options):
        self.verbosity = options['verbosity']
        for code, name in settings.LANGUAGES:
            code = to_locale(code)
            if self.verbosity > 0:
                print("Processing", name)
            path = ROOT / '{code}.json'.format(code=code)
            if not path.exists():
                print(path, 'doest not exist', 'Skipping')
            else:
                with path.open(encoding="utf-8") as f:
                    if self.verbosity > 1:
                        print("Found file", path)
                    self.render(code, f.read())

    def render(self, code, json):
        path = ROOT / '{code}.js'.format(code=code)
        with path.open("w", encoding="utf-8") as f:
            content = render_to_string('umap/locale.js', {
                "locale": json,
                "locale_code": code
            })
            if self.verbosity > 1:
                print("Exporting to", path)
            f.write(content)
