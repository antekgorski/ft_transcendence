from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FriendshipViewSet, NotificationViewSet

app_name = 'social'

router = DefaultRouter()
router.register(r'friendships', FriendshipViewSet, basename='friendship')
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = [
    path('', include(router.urls)),
]
