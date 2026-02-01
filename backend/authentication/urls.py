from django.urls import path
from .views import register
from .views import login
# from (42 OAuth)
from .views import oauth_42_start, oauth_42_callback

# URL patterns for authentication app
urlpatterns = [
    # Registration endpoint
    path('register/', register, name='register'),
    # Login endpoint
    path('login/', login, name='login'),
    # 42 OAuth login endpoint
    path('oauth/42/start/', oauth_42_start, name='oauth_42_start'),
    path('oauth/42/callback/', oauth_42_callback, name='oauth_42_callback'),
]