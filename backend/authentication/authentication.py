from rest_framework import authentication
from rest_framework import exceptions
from .models import User


class SessionAuthentication(authentication.BaseAuthentication):
    """
    Custom session authentication that uses our session-based user_id storage
    """
    def authenticate(self, request):
        user_id = request.session.get('user_id')
        if not user_id:
            return None
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed('User not found')

        if not getattr(user, "is_active", True):
            raise exceptions.AuthenticationFailed('User account is disabled')
        
        return (user, None)
