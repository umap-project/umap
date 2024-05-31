from django.conf import settings
from django.core.management.base import BaseCommand

from umap import websocket_server


class Command(BaseCommand):
    help = "Run the websocket server"

    def add_arguments(self, parser):
        parser.add_argument(
            "--host",
            help="The server host to bind to.",
            default=settings.WEBSOCKET_BACK_HOST,
        )
        parser.add_argument(
            "--port",
            help="The server port to bind to.",
            default=settings.WEBSOCKET_BACK_PORT,
        )

    def handle(self, *args, **options):
        websocket_server.run(options["host"], options["port"])
