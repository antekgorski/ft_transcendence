#from django.shortcuts import render

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

# Simple registration endpoint - input only, no DB yet
# Prosty endpoint rejestracji - tylko odbiera dane, bez bazy
@api_view(['POST'])
def register(request):
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
                "detail": "username, email and password are required.",
                # Komunikat po polsku
                "detail_pl": "username, email i password są wymagane."
            },
            status=status.HTTP_400_BAD_REQUEST
        )

    # Echo back for now (for frontend testing)
    # Na razie tylko odsyłamy dane z powrotem (do testów frontendu)
    return Response(
        {
            "username": username,
            "email": email,
            "password": password,  # później NIE będziemy odsyłać hasła
            "message": "Registration data received.",
            "message_pl": "Dane rejestracyjne odebrane."
        },
        status=status.HTTP_200_OK
    )
