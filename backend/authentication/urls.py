from django.urls import path
from .views import register, login, get_current_user, logout, set_avatar, update_profile, csrf, upload_avatar, search_users, get_user_profile
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
    # CSRF endpoint
    path('csrf/', csrf, name='csrf'),
    # Logout endpoint
    path('logout/', logout, name='logout'),
    # Update profile endpoint
    path('profile/update/', update_profile, name='update_profile'),
    # Set avatar endpoint (choose from defaults 1-4)
    path('avatar/set/', set_avatar, name='set_avatar'),
    # 42 OAuth login endpoint
    path('oauth/42/start/', oauth_42_start, name='oauth_42_start'),
    path('oauth/42/callback/', oauth_42_callback, name='oauth_42_callback'),
    # Upload custom avatar
    path('avatar/upload/', upload_avatar, name='upload_avatar'),
    # Search users
    path('users/search/', search_users, name='search_users'),
    # Public user profile
    path('users/<uuid:user_id>/', get_user_profile, name='get_user_profile'),
]