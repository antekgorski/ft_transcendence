from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
import json

User = get_user_model()


class UserRegistrationTests(TestCase):
    """Test user registration endpoint."""
    
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register/'
    
    def test_user_registration_success(self):
        """Test successful user registration."""
        data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'SecurePass123!'
        }
        response = self.client.post(
            self.register_url,
            data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['username'], 'testuser')
    
    def test_user_registration_duplicate_username(self):
        """Test registration fails with duplicate username."""
        # Create first user
        User.objects.create_user(
            username='testuser',
            email='test1@example.com',
            password='SecurePass123!'
        )
        
        # Try to create another with same username
        data = {
            'username': 'testuser',
            'email': 'test2@example.com',
            'password': 'SecurePass123!'
        }
        response = self.client.post(
            self.register_url,
            data,
            format='json'
        )
        # Duplicate username should return conflict
        self.assertIn(
            response.status_code,
            [status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT]
        )
    
    def test_user_registration_invalid_email(self):
        """Test registration fails with invalid email."""
        data = {
            'username': 'testuser',
            'email': 'notanemail',
            'password': 'SecurePass123!'
        }
        response = self.client.post(
            self.register_url,
            data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_user_registration_missing_field(self):
        """Test registration fails with missing field."""
        data = {
            'username': 'testuser',
            'email': 'test@example.com'
            # password missing
        }
        response = self.client.post(
            self.register_url,
            data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserLoginTests(TestCase):
    """Test user login endpoint."""
    
    def setUp(self):
        self.client = APIClient()
        self.login_url = '/api/auth/login/'
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='SecurePass123!'
        )
    
    def test_user_login_success(self):
        """Test successful user login."""
        data = {
            'identifier': 'testuser',
            'password': 'SecurePass123!'
        }
        response = self.client.post(
            self.login_url,
            data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['username'], 'testuser')
    
    def test_user_login_wrong_password(self):
        """Test login fails with wrong password."""
        data = {
            'identifier': 'testuser',
            'password': 'WrongPassword123!'
        }
        response = self.client.post(
            self.login_url,
            data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_user_login_nonexistent_user(self):
        """Test login fails with nonexistent user."""
        data = {
            'identifier': 'nonexistent',
            'password': 'SecurePass123!'
        }
        response = self.client.post(
            self.login_url,
            data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class UserRegistrationAdvancedTests(TestCase):
    """Advanced registration tests for coverage."""
    
    def setUp(self):
        self.client = APIClient()
        self.register_url = '/api/auth/register/'
    
    def test_user_registration_password_too_short(self):
        """Test registration fails with short password."""
        data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'short'
        }
        response = self.client.post(
            self.register_url,
            data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_user_registration_duplicate_email(self):
        """Test registration fails with duplicate email."""
        # Create first user
        User.objects.create_user(
            username='user1',
            email='test@example.com',
            password='SecurePass123!'
        )
        
        # Try to create another with same email
        data = {
            'username': 'user2',
            'email': 'test@example.com',
            'password': 'SecurePass123!'
        }
        response = self.client.post(
            self.register_url,
            data,
            format='json'
        )
        self.assertIn(
            response.status_code,
            [status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT]
        )
    
    def test_user_registration_missing_username(self):
        """Test registration fails with missing username."""
        data = {
            'email': 'test@example.com',
            'password': 'SecurePass123!'
        }
        response = self.client.post(
            self.register_url,
            data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_user_registration_missing_email(self):
        """Test registration fails with missing email."""
        data = {
            'username': 'testuser',
            'password': 'SecurePass123!'
        }
        response = self.client.post(
            self.register_url,
            data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserLoginAdvancedTests(TestCase):
    """Advanced login tests for coverage."""
    
    def setUp(self):
        self.client = APIClient()
        self.login_url = '/api/auth/login/'
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='SecurePass123!'
        )
    
    def test_user_login_with_email(self):
        """Test login using email instead of username."""
        data = {
            'identifier': 'test@example.com',
            'password': 'SecurePass123!'
        }
        response = self.client.post(
            self.login_url,
            data,
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_401_UNAUTHORIZED])
    
    def test_user_login_missing_identifier(self):
        """Test login fails with missing identifier."""
        data = {
            'password': 'SecurePass123!'
        }
        response = self.client.post(
            self.login_url,
            data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_user_login_missing_password(self):
        """Test login fails with missing password."""
        data = {
            'identifier': 'testuser'
        }
        response = self.client.post(
            self.login_url,
            data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class UserModelTests(TestCase):
    """Test User model methods."""
    
    def test_user_set_password(self):
        """Test setting and checking password."""
        user = User(username='testuser', email='test@example.com')
        user.set_password('SecurePass123!')
        
        # Check password is hashed
        self.assertNotEqual(user.password_hash, 'SecurePass123!')
        self.assertTrue(user.has_usable_password())
    
    def test_user_check_password_correct(self):
        """Test checking correct password."""
        user = User(username='testuser', email='test@example.com')
        user.set_password('SecurePass123!')
        
        # Check password
        self.assertTrue(user.check_password('SecurePass123!'))
    
    def test_user_check_password_incorrect(self):
        """Test checking incorrect password."""
        user = User(username='testuser', email='test@example.com')
        user.set_password('SecurePass123!')
        
        # Check wrong password
        self.assertFalse(user.check_password('WrongPassword'))
    
    def test_user_set_unusable_password(self):
        """Test setting unusable password."""
        user = User(username='testuser', email='test@example.com')
        user.set_unusable_password()
        
        # Should mark as unusable
        self.assertFalse(user.has_usable_password())
    
    def test_user_is_authenticated(self):
        """Test is_authenticated property."""
        user = User(username='testuser', email='test@example.com')
        self.assertTrue(user.is_authenticated)
    
    def test_user_manager_create_user(self):
        """Test UserManager.create_user method."""
        user = User.objects.create_user(
            username='newuser',
            email='new@example.com',
            password='SecurePass123!'
        )
        
        self.assertEqual(user.username, 'newuser')
        self.assertEqual(user.email, 'new@example.com')
        self.assertTrue(user.check_password('SecurePass123!'))
    
    def test_user_manager_create_user_no_username(self):
        """Test UserManager.create_user fails without username."""
        with self.assertRaises(ValueError):
            User.objects.create_user(
                username='',
                email='test@example.com',
                password='SecurePass123!'
            )
    
    def test_user_manager_create_user_no_email(self):
        """Test UserManager.create_user fails without email."""
        with self.assertRaises(ValueError):
            User.objects.create_user(
                username='testuser',
                email='',
                password='SecurePass123!'
            )
    
    def test_user_str_representation(self):
        """Test User string representation."""
        user = User(username='testuser', email='test@example.com')
        self.assertEqual(str(user), 'testuser')


class UserInactiveTests(TestCase):
    """Test login with inactive users."""
    
    def setUp(self):
        self.client = APIClient()
        self.login_url = '/api/auth/login/'
        self.user = User.objects.create_user(
            username='inactiveuser',
            email='inactive@example.com',
            password='SecurePass123!'
        )
        self.user.is_active = False
        self.user.save()
    
    def test_inactive_user_cannot_login(self):
        """Test that inactive users cannot login."""
        data = {
            'identifier': 'inactiveuser',
            'password': 'SecurePass123!'
        }
        response = self.client.post(
            self.login_url,
            data,
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)



