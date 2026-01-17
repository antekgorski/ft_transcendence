#from django.shortcuts import render

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError
from .models import User


@api_view(['POST'])
def register(request):
    """
    Registration endpoint - creates a new user in the database.
    Endpoint rejestracji - tworzy nowego użytkownika w bazie danych.
    """
    # Extract data from JSON body
    # Pobierz dane z ciała żądania (JSON)
    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')

    # Basic presence check
    # Podstawowe sprawdzenie, czy pola są podane
    if not username or not email or not password:
        return Response(
            {
                "error": "username, email and password are required.",
                "error_pl": "username, email i password są wymagane."
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # Password length validation
    # Walidacja długości hasła
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
        # Utwórz nowego użytkownika
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
