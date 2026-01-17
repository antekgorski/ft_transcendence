from django.urls import path
from .views import register

# URL patterns for authentication app
urlpatterns = [
    # Registration endpoint
    path('register/', register, name='register'),
]