from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GameViewSet
from .stats_view import player_stats, user_stats, user_game_history

app_name = 'game'

# Stats endpoint must come before the router to avoid being caught by the catch-all router
urlpatterns = [
    path('games/stats/me/', player_stats, name='player_stats'),
    path('games/stats/<uuid:user_id>/', user_stats, name='user_stats'),
    path('games/history/<uuid:user_id>/', user_game_history, name='user_game_history'),
]

router = DefaultRouter()
router.register(r'games', GameViewSet, basename='game')

urlpatterns += [
    path('', include(router.urls)),
]

