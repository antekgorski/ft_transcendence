from django.urls import path
from .views import register, login, get_current_user, logout

# URL patterns for authentication app
urlpatterns = [
    # Registration endpoint
    path('register/', register, name='register'),
    # Login endpoint
    path('login/', login, name='login'),
    # Current user endpoint
    path('me/', get_current_user, name='get_current_user'),
    # Logout endpoint
    path('logout/', logout, name='logout'),
]