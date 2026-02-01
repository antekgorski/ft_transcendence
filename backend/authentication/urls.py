from django.urls import path
from .views import register, login, get_current_user, logout
# from (42 OAuth)
from .views import oauth_42_start, oauth_42_callback

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
    # 42 OAuth login endpoint
    path('oauth/42/start/', oauth_42_start, name='oauth_42_start'),
    path('oauth/42/callback/', oauth_42_callback, name='oauth_42_callback'),
]