#from django.shortcuts import render

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError
from django.db.models import Q
from django.utils import timezone
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from .models import User
# (42 OAuth)
from django.conf import settings
import requests
import json
from django.shortcuts import redirect

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
                "error": "username, email and password are required.",
                "error_pl": "username, email i password są wymagane."
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # Email format validation
    try:
        validate_email(email)
    except ValidationError:
        return Response(
            {
                "error": "Invalid email format.",
                "error_pl": "Niepoprawny format email."
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # Password length validation
    if len(password) < 8:
        return Response(
            {
                "error": "Password must be at least 8 characters long.",
                "error_pl": "Hasło musi mieć co najmniej 8 znaków."
            },
            status=status.HTTP_400_BAD_REQUEST
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

        # Create session for the new user (auto-login)
        request.session['user_id'] = str(user.id)
        request.session.modified = True

        return Response(
            {
                "message": "User registered successfully.",
                "message_pl": "Użytkownik zarejestrowany pomyślnie.",
                "user": {
                    "id": str(user.id),
                    "username": user.username,
                    "email": user.email,
                    "display_name": user.display_name,
                       "avatar_url": user.avatar_url,
                    "created_at": user.created_at.isoformat()
                }
            },
            status=status.HTTP_201_CREATED
        )

    except IntegrityError as e:
        error_message = str(e).lower()
        if 'username' in error_message:
            return Response(
                {
                    "error": "Username already exists.",
                    "error_pl": "Nazwa użytkownika już istnieje."
                },
                status=status.HTTP_409_CONFLICT
            )
        elif 'email' in error_message:
            return Response(
                {
                    "avatar_url": user.avatar_url,
                    "error": "Email already exists.",
                    "error_pl": "Email już istnieje."
                },
                status=status.HTTP_409_CONFLICT
            )
        else:
            return Response(
                {
                    "error": "User with these credentials already exists.",
                    "error_pl": "Użytkownik z tymi danymi już istnieje."
                },
                status=status.HTTP_409_CONFLICT
            )

    except Exception as e:
        return Response(
            {
                "error": "Registration failed. Please try again.",
                "error_pl": "Rejestracja nie powiodła się. Spróbuj ponownie.",
                "details": str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """Simple login endpoint that verifies credentials and returns user data.

    Accepts either username or email as identifier. No JWT/session handling yet –
    this will be added later according to project design.
    """
    identifier = (
        request.data.get('identifier')
        or request.data.get('username')
        or request.data.get('email')
    )
    password = request.data.get('password')

    if not identifier or not password:
        return Response(
            {
                "error": "identifier and password are required.",
                "error_pl": "identifier i hasło są wymagane.",
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        user = User.objects.get(
            Q(username__iexact=identifier) | Q(email__iexact=identifier)
        )
    except User.DoesNotExist:
        return Response(
            {
                "error": "Invalid credentials.",
                "error_pl": "Nieprawidłowe dane logowania.",
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    if not user.is_active:
        return Response(
            {
                "error": "Account is disabled.",
                "error_pl": "Konto jest zablokowane.",
            },
            status=status.HTTP_403_FORBIDDEN,
        )

    if not user.check_password(password):
        return Response(
            {
                "error": "Invalid credentials.",
                "error_pl": "Nieprawidłowe dane logowania.",
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])

    # Zapisz użytkownika w sesji
    request.session['user_id'] = str(user.id)
    request.session['username'] = user.username

    return Response(
        {
            "message": "Login successful.",
            "message_pl": "Logowanie powiodło się.",
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
            },
        },
        status=status.HTTP_200_OK,
    )


@ensure_csrf_cookie
@api_view(['GET'])
@permission_classes([AllowAny])
def get_current_user(request):
    """
    Endpoint sprawdzający aktualną sesję użytkownika.
    Zwraca dane zalogowanego użytkownika lub 401 jeśli niezalogowany.
    """
    user_id = request.session.get('user_id')
    
    if not user_id:
        return Response(
            {
                "error": "Authentication required.",
                "error_pl": "Wymagane uwierzytelnienie.",
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )
    
    try:
        user = User.objects.get(id=user_id)
        return Response(
            {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
            },
            status=status.HTTP_200_OK,
        )
    except User.DoesNotExist:
        # Sesja ma nieprawidłowe dane - wyczyść sesję
        request.session.flush()
        return Response(
            {
                "error": "User not found.",
                "error_pl": "Użytkownik nie znaleziony.",
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )


@api_view(['POST'])
@permission_classes([AllowAny])
def logout(request):
    """
    Endpoint wylogowujący użytkownika.
    Usuwa sesję użytkownika.
    """
    request.session.flush()
    return Response(
        {
            "message": "Logout successful.",
            "message_pl": "Wylogowanie powiodło się.",
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
        user = User.objects.get(id=request.session.get('user_id'))
        avatar = request.data.get('avatar')
        
        if avatar == 'intra':
            # Only OAuth users can use their Intra photo
            if user.oauth_provider != '42' or not user.oauth_id or not user.original_avatar_url:
                return Response(
                    {
                        "error": "Only 42 OAuth users can use their Intra photo.",
                        "error_pl": "Tylko użytkownicy 42 OAuth mogą używać swoich zdjęć z Intra."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Switch to Intra photo
            user.avatar_url = user.original_avatar_url
            user.save(update_fields=['avatar_url'])
            
            return Response(
                {
                    "message": "Avatar changed to Intra photo.",
                    "message_pl": "Avatar zmieniony na zdjęcie z Intra.",
                    "avatar_url": user.avatar_url
                },
                status=status.HTTP_200_OK
            )
        
        elif isinstance(avatar, int) and 1 <= avatar <= 4:
            # Set to default avatar
            user.avatar_url = user.get_default_avatar_url(avatar)
            user.save(update_fields=['avatar_url'])
            
            return Response(
                {
                    "message": "Avatar changed successfully.",
                    "message_pl": "Avatar zmieniony pomyślnie.",
                    "avatar_url": user.avatar_url
                },
                status=status.HTTP_200_OK
            )
        else:
            return Response(
                {
                    "error": "Invalid avatar. Choose 1-4 for default avatars or 'intra' for Intra photo.",
                    "error_pl": "Nieprawidłowy avatar. Wybierz 1-4 dla domyślnych avatarów lub 'intra' dla zdjęcia z Intra."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
    
    except User.DoesNotExist:
        return Response(
            {
                "error": "User not found.",
                "error_pl": "Użytkownik nie znaleziony."
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
                    "error": "display_name is required.",
                    "error_pl": "display_name jest wymagane."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(display_name.strip()) == 0:
            return Response(
                {
                    "error": "display_name cannot be empty.",
                    "error_pl": "display_name nie może być puste."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user.display_name = display_name.strip()
        user.save(update_fields=['display_name'])
        
        return Response(
            {
                "message": "Profile updated successfully.",
                "message_pl": "Profil zaktualizowany pomyślnie.",
                "user": {
                    "id": str(user.id),
                    "username": user.username,
                    "email": user.email,
                    "display_name": user.display_name,
                    "avatar_url": user.avatar_url,
                }
            },
            status=status.HTTP_200_OK
        )
    except Exception as e:
        return Response(
            {
                "error": "Failed to update profile.",
                "error_pl": "Nie udało się zaktualizować profilu.",
                "details": str(e)
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# 42 OAuth Login View

@api_view(['GET'])
@permission_classes([AllowAny])
def oauth_42_start(request):
    """
    Redirect user to 42 OAuth authorization page
    """
    client_id = settings.FORTY_TWO_CLIENT_ID
    redirect_uri = settings.FORTY_TWO_REDIRECT_URI
    authorize_url = (
        f"https://api.intra.42.fr/oauth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=public"
    )
    return redirect(authorize_url)


@api_view(['GET'])
@permission_classes([AllowAny])
def oauth_42_callback(request):
    """
    Handle callback from 42 OAuth, exchange code for token, create/login user
    """
    code = request.GET.get('code')
    if not code:
        return Response(
            {"error": "No authorization code provided"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Exchange code for access token
    token_url = "https://api.intra.42.fr/oauth/token"
    token_data = {
        "grant_type": "authorization_code",
        "client_id": settings.FORTY_TWO_CLIENT_ID,
        "client_secret": settings.FORTY_TWO_CLIENT_SECRET,
        "code": code,
        "redirect_uri": settings.FORTY_TWO_REDIRECT_URI,
    }

    try:
        token_response = requests.post(token_url, data=token_data)
        token_response.raise_for_status()
        token_json = token_response.json()
        access_token = token_json.get("access_token")
    except requests.RequestException as e:
        return Response(
            {"error": f"Failed to obtain access token: {str(e)}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Get user info from 42 API
    user_info_url = "https://api.intra.42.fr/v2/me"
    headers = {"Authorization": f"Bearer {access_token}"}

    try:
        user_response = requests.get(user_info_url, headers=headers)
        user_response.raise_for_status()
        user_data = user_response.json()
    except requests.RequestException as e:
        return Response(
            {"error": f"Failed to fetch user info: {str(e)}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Extract user data
    oauth_id = str(user_data.get("id"))
    username = user_data.get("login")
    email = user_data.get("email")
    first_name = user_data.get("first_name", "")
    last_name = user_data.get("last_name", "")
    avatar_url = user_data.get("image", {}).get("link", "")

    # Find or create user
    try:
        user = User.objects.get(oauth_provider="42", oauth_id=oauth_id)
    except User.DoesNotExist:
        # Check if user with this email already exists
        if User.objects.filter(email=email).exists():
            return Response(
                {
                    "error": "User with this email already exists",
                    "error_pl": "Użytkownik z tym emailem już istnieje"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create new user
        user = User.objects.create(
            username=username,
            email=email,
            display_name=f"{first_name} {last_name}".strip() or username,
            avatar_url=avatar_url,  # Store the 42 Intra photo URL directly
            original_avatar_url=avatar_url,  # Keep original Intra URL
            oauth_provider="42",
            oauth_id=oauth_id,
            is_active=True,
        )

    # Update last login
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])

    # Create secure session (httpOnly cookie will be set automatically by Django)
    request.session['user_id'] = str(user.id)
    request.session.modified = True
    
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
