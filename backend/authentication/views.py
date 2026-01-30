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
from .models import User


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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile(request):
    """
    Get current authenticated user's profile information.
    """
    user = request.user
    return Response(
        {
            "user": {
                "id": str(user.id),
                "username": user.username,
                "email": user.email,
                "display_name": user.display_name,
                "avatar_url": user.avatar_url,
                "language": user.language,
                "is_active": user.is_active,
                "created_at": user.created_at.isoformat(),
                "last_login": user.last_login.isoformat() if user.last_login else None,
            }
        },
        status=status.HTTP_200_OK,
    )
