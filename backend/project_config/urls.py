from django.urls import path, include

urlpatterns = [
    path('api/auth/', include('authentication.urls')),
    path('api/', include('game.urls')),
    path('api/social/', include('social.urls')),
]
