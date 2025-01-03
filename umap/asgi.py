import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "umap.settings")

from django.core.asgi import get_asgi_application

from .sync.app import application as ws_application

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()


async def application(scope, receive, send):
    if scope["type"] == "http":
        await django_asgi_app(scope, receive, send)
    elif scope["type"] == "websocket":
        await ws_application(scope, receive, send)
    else:
        raise NotImplementedError(f"Unknown scope type {scope['type']}")
