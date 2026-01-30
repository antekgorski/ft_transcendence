from django.urls import path
from .views import register, login, profile

# URL patterns for authentication app
urlpatterns = [
    # Registration endpoint
    path('register/', register, name='register'),
    # Login endpoint
    path('login/', login, name='login'),
    # Profile endpoint - get current user info
    path('profile/', profile, name='profile'),
]