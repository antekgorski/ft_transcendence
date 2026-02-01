from django.urls import re_path
from game.consumers import GameConsumer, NotificationConsumer

websocket_urlpatterns = [
    re_path(r'ws/games/$', GameConsumer.as_asgi()),
    re_path(r'ws/notifications/$', NotificationConsumer.as_asgi()),
]
