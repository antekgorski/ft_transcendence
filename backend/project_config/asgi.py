import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'project_config.settings')

django_asgi_app = get_asgi_application()

from project_config.routing import websocket_urlpatterns
from game.middleware import SessionUserAuthMiddlewareStack

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': SessionUserAuthMiddlewareStack(
        URLRouter(
            websocket_urlpatterns
        )
    ),
})
