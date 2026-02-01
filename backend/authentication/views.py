#from django.shortcuts import render

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError
from django.db.models import Q
from django.utils import timezone
from .models import User
# (42 OAuth)
from django.conf import settings
import requests
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
        # Create new user
        user = User(
            username=username,
            email=email,
            display_name=username,  # Default display_name to username
        )
        user.set_password(password)  # Hash the password
        user.save()

        return Response(
            {
                "message": "User registered successfully.",
                "message_pl": "Użytkownik zarejestrowany pomyślnie.",
                "user": {
                    "id": str(user.id),
                    "username": user.username,
                    "email": user.email,
                    "display_name": user.display_name,
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
            avatar_url=avatar_url,
            oauth_provider="42",
            oauth_id=oauth_id,
            is_active=True,
        )

    # Update last login
    user.last_login = timezone.now()
    user.save(update_fields=["last_login"])

    # Return user data (frontend can save this and treat as logged in)
    return Response(
        {
            "message": "Login via 42 successful",
            "message_pl": "Logowanie przez 42 powiodło się",
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
                "oauth_provider": user.oauth_provider,
                "created_at": user.created_at.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None,
            },
        },
        status=status.HTTP_200_OK
    )