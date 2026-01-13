import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Build paths inside the project
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Security
SECRET_KEY = os.environ.get('SECRET_KEY', 'insecure-key-for-sql-executor-only')
DEBUG = os.environ.get('DEBUG', 'False') == 'True'
ALLOWED_HOSTS = os.environ['ALLOWED_HOSTS'].split(',')

# Minimal apps for API-only project
INSTALLED_APPS = [
    'rest_framework',
    'corsheaders',
]

# Minimal middleware for API-only project
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
]

ROOT_URLCONF = 'sql_executor.urls'

WSGI_APPLICATION = 'sql_executor.wsgi.application'

# Database - Neon PostgreSQL (all required from .env)
#DATABASES = {
#    'default': {
#        'ENGINE': 'django.db.backends.postgresql',
#        'NAME': os.environ['DB_NAME'],
#        'USER': os.environ['DB_USER'],
#        'PASSWORD': os.environ['DB_PASSWORD'],
#        'HOST': os.environ['DB_HOST'],
#        'PORT': os.environ['DB_PORT'],
#        'OPTIONS': {
#            'sslmode': os.environ['DB_SSLMODE'],
#        },
#    }
#}

# Database - simple SQLite for local development
# Baza danych - proste SQLite do lokalnego developmentu
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        # db.sqlite3 will be created one level above this file
        # plik db.sqlite3 zostanie utworzony poziom wyżej niż ten plik
        'NAME': os.path.join(os.path.dirname(BASE_DIR), 'db.sqlite3'),
    }
}

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# CORS settings - Required from .env
CORS_ALLOWED_ORIGINS = os.environ['CORS_ALLOWED_ORIGINS'].split(',')
CORS_ALLOW_CREDENTIALS = True

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
    ],
    'UNAUTHENTICATED_USER': None,
    'UNAUTHENTICATED_TOKEN': None,
}

