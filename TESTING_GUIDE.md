# Backend Testing Guide

## Quick Start

Ensure containers are running:
```bash
docker-compose up -d
```

## Running Tests

### Run All Tests
```bash
# Run all backend tests
docker-compose exec -T backend python manage.py test

# Run with verbose output
docker-compose exec -T backend python manage.py test --verbosity=2
```

### Run Tests by Module

```bash
# Test user registration, login, and profiles
docker-compose exec -T backend python manage.py test authentication

# Test game creation, ship placement, and game logic
docker-compose exec -T backend python manage.py test game

# Test friendships, notifications, and social features
docker-compose exec -T backend python manage.py test social
```

### Run Specific Test Class or Method

```bash
# Run a specific test class
docker-compose exec -T backend python manage.py test authentication.tests.UserRegistrationTests

# Run a specific test method
docker-compose exec -T backend python manage.py test authentication.tests.UserRegistrationTests.test_user_registration_success
```

## Test Coverage

Generate a coverage report:

```bash
# Install coverage tool
docker-compose exec -T backend pip install coverage

# Run tests with coverage (keeps test database between runs)
docker-compose exec -T backend coverage run --source='.' manage.py test --keepdb

# View coverage report
docker-compose exec -T backend coverage report
```

## Test Structure

Tests are organized in:
- **`backend/authentication/tests.py`** - User registration, login, profile management
- **`backend/game/tests.py`** - REST API tests, AI opponent tests, Redis manager tests, WebSocket tests
- **`backend/social/tests.py`** - Friendship system, notifications

## Troubleshooting

### Tests Hang or Fail

```bash
# Rebuild containers
docker-compose down
docker-compose up -d

# Run tests again
docker-compose exec -T backend python manage.py test
```

### Test Database Already Exists Error

**Symptom:** `database "test_neondb" already exists` or `is being accessed by other users`

```bash
# Solution 1: Use --keepdb flag (recommended)
docker-compose exec -T backend python manage.py test --keepdb

# Solution 2: Stop containers and restart
docker-compose down
docker-compose up -d
docker-compose exec -T backend python manage.py test
```

### Database Errors

```bash
# Clear test database
docker-compose exec -T backend python manage.py flush --noinput

# Rebuild everything
docker-compose down
docker-compose up -d
```

### View Backend Logs

```bash
# Real-time logs
docker-compose logs -f backend

# Last 50 lines
docker-compose logs backend | tail -50
```
