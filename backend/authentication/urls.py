from django.urls import path
from .views import register

# URL patterns for authentication app
# Ścieżki URL dla aplikacji authentication
urlpatterns = [
    # Registration endpoint
    # Endpoint rejestracji
    path('register/', register, name='register'),
]