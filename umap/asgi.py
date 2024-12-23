import os

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.core.asgi import get_asgi_application
from django.urls import re_path

from . import consumers

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "umap.settings")
# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may import ORM models.
django_asgi_app = get_asgi_application()

urlpatterns = (re_path(r"ws/sync/(?P<map_id>\w+)/$", consumers.SyncConsumer.as_asgi()),)

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": consumers.TokenMiddleware(
            AllowedHostsOriginValidator(URLRouter(urlpatterns))
        ),
    }
)
