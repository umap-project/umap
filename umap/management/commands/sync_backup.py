import subprocess
from datetime import date
from pathlib import Path

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Synchronize today's backup with whatever rsync-able."

    def add_arguments(self, parser):
        parser.add_argument('path', help='Location of the backups.')
        parser.add_argument('destination', help='Destination of the backups.')

    def handle(self, *args, **options):
        today = date.today().isoformat()
        root = Path(options['path'])
        subprocess.call(
            ['rsync', '-rv', str(root), '--include', '*{}*'.format(today),
             options['destination']])
