from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GameViewSet
from .stats_view import player_stats

app_name = 'game'

# Stats endpoint must come before the router to avoid being caught by the catch-all router
urlpatterns = [
    path('games/stats/me/', player_stats, name='player_stats'),
]

router = DefaultRouter()
router.register(r'games', GameViewSet, basename='game')

urlpatterns += [
    path('', include(router.urls)),
]
