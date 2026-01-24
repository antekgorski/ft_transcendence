from django.urls import path
from .views import register
from .views import login

# URL patterns for authentication app
urlpatterns = [
    # Registration endpoint
    path('register/', register, name='register'),
    # Login endpoint
    path('login/', login, name='login'),
]