#from django.shortcuts import render

from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError
from django.db.models import Q
from django.utils import timezone
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.http import HttpResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.core.files.base import ContentFile
from rest_framework.parsers import MultiPartParser, FormParser
from .models import User
# (42 OAuth)
from django.conf import settings
import requests
from django.core.cache import cache
from importlib import import_module
from django.conf import settings
from game.redis_manager import GameStateManager
from urllib.parse import urlencode
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import logging
import logging

logger = logging.getLogger(__name__)

SessionStore = import_module(settings.SESSION_ENGINE).SessionStore

def clear_user_sessions(user_id):
    """
    Finds and deletes any active Django sessions that belong to the given user UUID using Cache.
    This enforces a single active session per user.
    """
    user_id_str = str(user_id)
    cache_key = f"active_sessions_{user_id_str}"
    old_sessions = cache.get(cache_key, [])
    
    print(f"DEBUG: Attempting to clear {len(old_sessions)} sessions for user_id={user_id_str} via cache")
    deleted_count = 0
    for old_key in old_sessions:
        if old_key:
            SessionStore(session_key=old_key).delete()
            print(f"DEBUG: Deleted session {old_key}")
            deleted_count += 1
            
    cache.delete(cache_key)
    
    # Broadcast force logout to any active WebSockets for this user
    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{user_id_str}",
            {
                "type": "force_logout",
                "message": "Logged in from another device."
            }
        )
        print(f"DEBUG: Broadcasted force_logout to user_{user_id_str}")
    except Exception as e:
        print(f"DEBUG: Failed to broadcast force_logout: {e}")
        
    print(f"DEBUG: Finished clearing sessions, deleted {deleted_count} total")

def track_user_session(user_id, session_key):
    """Stores the active session key in cache so it can be cleared later."""
    if not session_key:
        print("DEBUG: track_user_session called but session_key is empty/None!")
        return
    user_id_str = str(user_id)
    cache_key = f"active_sessions_{user_id_str}"
    
    sessions = cache.get(cache_key, [])
    if session_key not in sessions:
        sessions.append(session_key)
        cache.set(cache_key, sessions, 86400) # Match 24hr SESSION_COOKIE_AGE
        print(f"DEBUG: Tying session {session_key} to user {user_id}. Cache now has: {sessions}")
    else:
        print(f"DEBUG: Session {session_key} already recorded. Cache has: {sessions}")

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    Registration endpoint - creates a new user in the database.
    """
    # Extract data from JSON body
    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')

    # Basic presence check
    if not username or not email or not password:
        return Response(
            {
                "ok": False,
                "error": "Username, email and password are required.",
            },
            status=status.HTTP_200_OK
        )

    # Email format validation
    try:
        validate_email(email)
    except ValidationError:
        return Response(
            {
                "ok": False,
                "error": "Invalid email format.",
            },
            status=status.HTTP_200_OK
        )

    # Password length validation
    if len(password) < 8:
        return Response(
            {
                "ok": False,
                "error": "Password must be at least 8 characters long.",
            },
            status=status.HTTP_200_OK
        )

    try:
        # Create new user with hashed password
        user = User(
            username=username,
            email=email,
            display_name=username,
        )
        user.set_password(password)  # Hash and set the password BEFORE saving
        user.assign_random_default_avatar()  # Assign random default avatar URL
        user.save()  # Now save with the password included

        # Clear existing sessions for this user before creating a new one
        clear_user_sessions(user.id)

        # Create session for the new user (auto-login)
        request.session.flush()
        request.session['user_id'] = str(user.id)
        request.session.modified = True
        
        # Save session to generate a session_key immediately, then track it
        request.session.save()
        track_user_session(user.id, request.session.session_key)

        return Response(
            {
                "ok": True,
                "message": "User registered successfully.",
                "user": {
                    "id": str(user.id),
                    "username": user.username,
                    "email": user.email,
                    "display_name": user.display_name,
                    "avatar_url": user.avatar_url.url if user.avatar_url else None,
                    "created_at": user.created_at.isoformat()
                }
            },
            status=status.HTTP_200_OK
        )

    except IntegrityError as e:
        error_message = str(e).lower()
        if 'username' in error_message:
            return Response(
                {
                    "ok": False,
                    "error": "Username already exists.",
                },
                status=status.HTTP_200_OK
            )
        elif 'email' in error_message:
            return Response(
                {
                    "ok": False,
                    "error": "Email already exists.",
                },
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {
                    "ok": False,
                    "error": "User with these credentials already exists.",
                },
                status=status.HTTP_200_OK
            )

    except Exception as e:
        return Response(
            {
                "ok": False,
                "error": "Registration failed. Please try again.",
                "details": str(e)
            },
            status=status.HTTP_200_OK
        )



def get_safe_avatar_url(field):
    """Helper to return URL only if file actually exists."""
    if field and field.name:
        try:
            # Use storage to check existence. 
            # Note: This might cause a slight performance hit on slow storage, 
            # but essential for consistency if files are manually deleted.
            if field.storage.exists(field.name):
                return field.url
        except Exception:
            pass
    return None

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """Simple login endpoint that verifies credentials and returns user data.

    Accepts either username or email as identifier.
    Creates a session for the authenticated user.
    """
    identifier = (
        request.data.get('identifier')
        or request.data.get('username')
        or request.data.get('email')
    )
    password = request.data.get('password')

    if not identifier or not password:
        # keep validation on frontend as well; still return 200 so network
        # panel doesn't mark as error
        return Response(
            {
                "ok": False,
                "error": "Identifier and password are required.",
            },
            status=status.HTTP_200_OK,
        )

    try:
        user = User.objects.get(
            Q(username__iexact=identifier) | Q(email__iexact=identifier)
        )
    except User.DoesNotExist:
        return Response(
            {
                "ok": False,
                "error": "Incorrect login details",
            },
            status=status.HTTP_200_OK,
        )

    if not user.is_active:
        return Response(
            {
                "ok": False,
                "error": "Account is disabled.",
            },
            status=status.HTTP_200_OK,
        )

    if not user.check_password(password):
        return Response(
            {
                "ok": False,
                "error": "Incorrect login details",
            },
            status=status.HTTP_200_OK,
        )

    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])

    # Clear existing sessions for this user before creating a new one
    clear_user_sessions(user.id)

    # Zapisz użytkownika w sesji
    request.session.flush()
    request.session['user_id'] = str(user.id)
    request.session['username'] = user.username
    
    # Save session to generate a session_key immediately, then track it
    request.session.save()
    track_user_session(user.id, request.session.session_key)

    return Response(
        {
            "ok": True,
            "message": "Login successful.",
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "display_name": user.display_name,
                "avatar_url": get_safe_avatar_url(user.avatar_url),
            },
        },
        status=status.HTTP_200_OK,
    )


@ensure_csrf_cookie
@api_view(['GET'])
@permission_classes([AllowAny])
def get_current_user(request):
    user_id = request.session.get('user_id')
    
    if not user_id:
        return Response(
            {
                "user": None
            },
            status=status.HTTP_200_OK,
        )
    
    try:
        user = User.objects.get(id=user_id)
        redis_manager = GameStateManager()
        # Refresh online presence on every /me/ call (acts as heartbeat)
        redis_manager.set_user_online(str(user.id))
        return Response(
            {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "display_name": user.display_name,
                "avatar_url": get_safe_avatar_url(user.avatar_url),
                "custom_avatar_url": get_safe_avatar_url(user.custom_avatar_url),
                "intra_avatar_url": get_safe_avatar_url(user.intra_avatar_url),
                "is_online": redis_manager.is_user_online(str(user.id)),
            },
            status=status.HTTP_200_OK,
        )
    except User.DoesNotExist:
        request.session.flush()
        return Response(
            {
                "user": None
            },
            status=status.HTTP_200_OK,
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_users(request):
    """
    Search users by username or display name.
    Query param: q (min 2 chars)
    """
    query = request.GET.get('q', '').strip()

    if len(query) < 2:
        return Response(
            {"error": "Search query must be at least 2 characters"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    users = (
        User.objects.filter(
            Q(username__icontains=query) | Q(display_name__icontains=query)
        )
        .exclude(id=request.user.id)
        .order_by('username')[:20]
    )

    results = [
        {
            "id": str(user.id),
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": get_safe_avatar_url(user.avatar_url),
        }
        for user in users
    ]

    return Response({"results": results}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_profile(request, user_id):
    """
    Get public profile data for a specific user.
    """
    try:
        user = User.objects.get(id=user_id, is_active=True)
    except User.DoesNotExist:
        return Response(
            {"error": "User not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    redis_manager = GameStateManager()
    return Response(
        {
            "id": str(user.id),
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": get_safe_avatar_url(user.avatar_url),
            "is_online": redis_manager.is_user_online(str(user_id)),
        },
        status=status.HTTP_200_OK,
    )


@ensure_csrf_cookie
@api_view(['GET'])
@permission_classes([AllowAny])
def csrf(request):
    """
    Endpoint ensuring CSRF cookie is set.
    """
    return Response(
        {"message": "CSRF cookie set"},
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def logout(request):
    request.session.flush()
    return Response(
        {
            "message": "Logout successful.",
        },
        status=status.HTTP_200_OK,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def set_avatar(request):
    """
    Set user's avatar to one of the default avatars (1-4) or to their Intra photo (for OAuth users).
    Expects JSON: {"avatar": 1} or {"avatar": "intra"} for OAuth users
    """
    try:
        user = request.user
        avatar = request.data.get('avatar')
        
        if avatar == 'intra':
            # Only OAuth users can use their Intra photo
            if user.oauth_provider != '42' or not user.oauth_id or not user.intra_avatar_url:
                return Response(
                    {
                        "error": "Only 42 OAuth users can use their Intra photo.",
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Switch to Intra photo
            if user.intra_avatar_url:
                # We need to assign the file from original to avatar_url
                # Since both are ImageFields, we can assign the file object/name
                user.avatar_url = user.intra_avatar_url.name
                user.save()
            
            return Response(
                {
                    "message": "Avatar changed to Intra photo.",
                    "avatar_url": user.avatar_url.url if user.avatar_url else None
                },
                status=status.HTTP_200_OK
            )
        
        elif avatar == 'custom':
            if not user.custom_avatar_url:
                return Response(
                    {"error": "No custom avatar available."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user.avatar_url = user.custom_avatar_url.name
            user.save()
            return Response(
                {
                    "message": "Avatar changed to custom upload.",
                    "avatar_url": user.avatar_url.url if user.avatar_url else None
                },
                status=status.HTTP_200_OK
            )
        
        elif isinstance(avatar, int) and 1 <= avatar <= 4:
            # Set to default avatar
            # For default avatars, we are storing a relative path string in the ImageField
            # This is technically valid as Django treats it as a path
            user.avatar_url = user.get_default_avatar_url(avatar)
            user.save()
            
            return Response(
                {
                    "message": "Avatar changed successfully.",
                    "avatar_url": user.avatar_url.url if user.avatar_url else None
                },
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {
                    "error": "Invalid avatar. Choose 1-4 for default avatars or 'intra' for Intra photo.",
                },
                status=status.HTTP_400_BAD_REQUEST
            )
    
    except User.DoesNotExist:
        return Response(
            {
                "error": "User not found.",
            },
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """
    Update user profile information (display_name)
    """
    try:
        user = request.user
        display_name = request.data.get('display_name')
        
        if not display_name:
            return Response(
                {
                    "error": "Display name is required.",
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(display_name.strip()) == 0:
            return Response(
                {
                    "error": "Display name cannot be empty.",
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.display_name = display_name.strip()
        user.save(update_fields=['display_name'])
        
        return Response(
            {
                "message": "Profile updated successfully.",
                "user": {
                    "id": str(user.id),
                    "username": user.username,
                    "email": user.email,
                    "display_name": user.display_name,
                    "avatar_url": get_safe_avatar_url(user.avatar_url),
                    "custom_avatar_url": get_safe_avatar_url(user.custom_avatar_url),
                    "intra_avatar_url": get_safe_avatar_url(user.intra_avatar_url),
                }
            },
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {
                "error": "Failed to update profile.",
                "details": str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# 42 OAuth Login View

def _get_42_redirect_uri(request):
    configured_uri = getattr(settings, 'FORTY_TWO_REDIRECT_URI', None)
    if configured_uri:
        return configured_uri
    return request.build_absolute_uri('/api/auth/oauth/42/callback/')


def _oauth_error_redirect(error_message, error_code='oauth_failed'):
    query = urlencode({
        'oauth_error': error_message,
        'oauth_error_code': error_code,
    })
    html_response = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Authentication error</title>
    </head>
    <body>
        <script>
            window.location.href = '/?{query}';
        </script>
    </body>
    </html>
    """
    return HttpResponse(html_response, content_type='text/html')

@api_view(['GET'])
@permission_classes([AllowAny])
def oauth_42_start(request):
    """
    Return 42 OAuth authorization URL if provider is reachable.
    This allows frontend to show a friendly error when 42 API is unavailable.
    """
    client_id = settings.FORTY_TWO_CLIENT_ID
    redirect_uri = _get_42_redirect_uri(request)

    authorize_url = "https://api.intra.42.fr/oauth/authorize?" + urlencode({
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "public",
    })

    # Pre-check provider availability to avoid hard browser redirect to a 503 page.
    try:
        health_response = requests.get("https://api.intra.42.fr", timeout=5)
        if health_response.status_code >= 500:
            return Response(
                {
                    "ok": False,
                    "error": "42 OAuth is temporarily unavailable. Please try again in a few minutes.",
                    "error_code": "oauth_provider_unavailable",
                },
                status=status.HTTP_200_OK,
            )
    except requests.RequestException:
        return Response(
            {
                "ok": False,
                "error": "42 OAuth is temporarily unavailable. Please try again in a few minutes.",
                "error_code": "oauth_provider_unavailable",
            },
            status=status.HTTP_200_OK,
        )

    return Response(
        {
            "ok": True,
            "authorize_url": authorize_url,
        },
        status=status.HTTP_200_OK,
    )


@api_view(['GET'])
@permission_classes([AllowAny])
def oauth_42_callback(request):
    """
    Handle callback from 42 OAuth, exchange code for token, create/login user
    """
    code = request.GET.get('code')
    if not code:
        # could be user cancelled or redirect mismatch; include any error param
        err = request.GET.get('error') or 'No authorization code provided'
        return _oauth_error_redirect(err, 'oauth_missing_code')

    # Exchange code for access token
    token_url = "https://api.intra.42.fr/oauth/token"
    redirect_uri = _get_42_redirect_uri(request)
    
    token_data = {
        "grant_type": "authorization_code",
        "client_id": settings.FORTY_TWO_CLIENT_ID,
        "client_secret": settings.FORTY_TWO_CLIENT_SECRET,
        "code": code,
        "redirect_uri": redirect_uri,
    }

    try:
        token_response = requests.post(token_url, data=token_data)
        token_response.raise_for_status()
        token_json = token_response.json()
        access_token = token_json.get("access_token")
    except requests.RequestException as e:
        if hasattr(e, 'response') and e.response is not None:
            logger.warning(
                "42 OAuth token exchange failed: %s | status=%s | body=%s",
                str(e),
                e.response.status_code,
                e.response.text,
            )
        else:
            logger.warning("42 OAuth token exchange failed: %s", str(e))
        return _oauth_error_redirect(
            '42 OAuth is temporarily unavailable. Please try again in a few minutes.',
            'oauth_token_exchange_failed',
        )

    # Get user info from 42 API
    user_info_url = "https://api.intra.42.fr/v2/me"
    headers = {"Authorization": f"Bearer {access_token}"}

    try:
        user_response = requests.get(user_info_url, headers=headers)
        user_response.raise_for_status()
        user_data = user_response.json()
    except requests.RequestException as e:
        logger.warning("42 OAuth user info fetch failed: %s", str(e))
        return _oauth_error_redirect(
            'Failed to fetch user data from 42. Please try again.',
            'oauth_userinfo_failed',
        )

    # Extract user data
    oauth_id = str(user_data.get("id"))
    username = user_data.get("login")
    email = user_data.get("email")
    first_name = user_data.get("first_name", "")
    last_name = user_data.get("last_name", "")
    avatar_url = user_data.get("image", {}).get("link", "")

    # Find or create user
    created = False
    try:
        user = User.objects.get(oauth_provider="42", oauth_id=oauth_id)
    except User.DoesNotExist:
        # Check if user with this email already exists
        if User.objects.filter(email=email).exists():
            return _oauth_error_redirect(
                'User with this email already exists.',
                'oauth_email_conflict',
            )

        # Create new user
        user = User.objects.create(
            username=username,
            email=email,
            display_name=f"{first_name} {last_name}".strip() or username,
            oauth_provider="42",
            oauth_id=oauth_id,
            is_active=True,
        )
        created = True

    # Handle Avatar Download (for new users or if missing)
    # We download if:
    # 1. User is new
    # 2. User has no original_avatar_url (cleaned by migration)
    # Handle Avatar Download (for new users, missing avatar, or missing file)
    should_download = False
    if created or not user.intra_avatar_url:
        should_download = True
    else:
        # Check if file physically exists
        try:
            if not user.intra_avatar_url.storage.exists(user.intra_avatar_url.name):
                should_download = True
        except Exception:
            should_download = True

    if should_download and avatar_url:
        # Validate avatar URL to prevent SSRF: require HTTPS and trusted domain
        from urllib.parse import urlparse
        parsed_url = urlparse(avatar_url)
        allowed_domains = ("cdn.intra.42.fr",)
        hostname = parsed_url.hostname or ""
        is_allowed_domain = any(
            hostname == domain or hostname.endswith("." + domain)
            for domain in allowed_domains
        )

        if parsed_url.scheme != "https" or not is_allowed_domain:
            print(f"Refusing to download avatar from untrusted URL: {avatar_url}")
        else:
            try:
                # SAFETY: Use timeout to prevent hanging, and stream to check size
                response = requests.get(avatar_url, timeout=5, stream=True)
                
                # Check size header first (fast fail)
                content_length = response.headers.get('content-length')
                if content_length and int(content_length) > 2 * 1024 * 1024:
                    response.close()
                    print(f"Avatar too large (header): {content_length}")
                    should_download = False
                
                if should_download and response.status_code == 200:
                    from io import BytesIO
                    file_content = BytesIO()
                    size = 0
                    max_size = 2 * 1024 * 1024  # 2MB
                    
                    # Read chunks to enforce size limit securely
                    for chunk in response.iter_content(8192):
                        size += len(chunk)
                        if size > max_size:
                            file_content = None
                            print("Avatar too large (streamed)")
                            break
                        file_content.write(chunk)
                    
                    if file_content:
                        file_content.seek(0)
                        import os
                        
                        # Delete old original avatar if it exists
                        if user.intra_avatar_url:
                             try:
                                # Use storage-agnostic delete
                                user.intra_avatar_url.delete(save=False)
                             except Exception as e:
                                print(f"Error deleting old original avatar: {e}")

                        # Save to intra_avatar_url
                        import uuid
                        short_uuid = uuid.uuid4().hex[:8]
                        file_name = f"{user.id}_intra_{short_uuid}.jpg"
                        
                        user.intra_avatar_url.save(file_name, ContentFile(file_content.read()), save=False)
                        
                        # If created or avatar_url is empty, set avatar_url too
                        if created or not user.avatar_url:
                            user.avatar_url = user.intra_avatar_url.name
                        
                        user.save()
            except Exception as e:
                print(f"Failed to download avatar: {e}")
    # Update last login
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])

    # Clear existing sessions for this user before creating a new one
    clear_user_sessions(user.id)

    # Create secure session (httpOnly cookie will be set automatically by Django)
    request.session.flush()
    request.session['user_id'] = str(user.id)
    request.session.modified = True
    
    # Save session to generate a session_key immediately, then track it
    request.session.save()
    track_user_session(user.id, request.session.session_key)
    
    # Redirect to frontend root - will use the same domain/origin from the browser
    html_response = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Logging in...</title>
    </head>
    <body>
        <script>
            // Session established via httpOnly cookie
            // Redirect to root of same origin - frontend will verify user via /me/ endpoint
            window.location.href = '/';
        </script>
    </body>
    </html>
    """
    return HttpResponse(html_response, content_type='text/html')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_avatar(request):
    """
    Upload a custom avatar.
    """
    user = request.user
    file = request.FILES.get('avatar')
    
    if not file:
        return Response(
            {"error": "No file provided."},
            status=status.HTTP_400_BAD_REQUEST
        )
        
    # Validate file size (e.g. 2MB)
    if file.size > 2 * 1024 * 1024:
        return Response(
            {"error": "File too large. Max size is 2MB."},
            status=status.HTTP_400_BAD_REQUEST
        )
        
    # Validate file type
    if not file.content_type.startswith('image/'):
        return Response(
            {"error": "Invalid file type. Please upload an image."},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        import uuid
        import os
        ext = file.name.split('.')[-1]
        # Use user_id + custom + short_uuid to be recognizable but avoid caching issues
        short_uuid = uuid.uuid4().hex[:8]
        filename = f"{user.id}_custom_{short_uuid}.{ext}"
        
        # Delete old custom avatar if it exists
        if user.custom_avatar_url:
            try:
                # Use storage-agnostic delete
                user.custom_avatar_url.delete(save=False)
            except Exception as e:
                print(f"Error deleting old custom avatar: {e}")

        # Save to custom_avatar_url (persistence)
        # model's save method will handle optimization
        user.custom_avatar_url.save(filename, file)
        
        # Point avatar_url to the same file (by reference)
        # We assign the FieldFile object to the other field
        user.avatar_url = user.custom_avatar_url.name
        
        user.save()
        
        return Response(
            {
                "message": "Avatar uploaded successfully.",
                "avatar_url": user.avatar_url.url if user.avatar_url else None
            },
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {"error": f"Failed to upload avatar: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
