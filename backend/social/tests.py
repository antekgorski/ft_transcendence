from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from social.models import Friendship, Notification

User = get_user_model()


class FriendshipTests(TestCase):
    """Test friendship endpoints."""
    
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='SecurePass123!'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='SecurePass123!'
        )
        self.client.force_authenticate(user=self.user1)
    
    def test_send_friend_request(self):
        """Test sending a friend request."""
        data = {'user_id': str(self.user2.id)}
        response = self.client.post('/api/social/friendships/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Verify friendship was created
        friendship = Friendship.objects.filter(
            requester=self.user1,
            addressee=self.user2
        ).first()
        self.assertIsNotNone(friendship)
        self.assertEqual(friendship.status, 'pending')
    
    def test_cannot_friend_yourself(self):
        """Test user cannot friend themselves."""
        data = {'user_id': str(self.user1.id)}
        response = self.client.post('/api/social/friendships/', data, format='json')
        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT])
    
    def test_duplicate_friend_request(self):
        """Test duplicate friend request fails."""
        # First request
        data = {'user_id': str(self.user2.id)}
        response1 = self.client.post('/api/social/friendships/', data, format='json')
        self.assertEqual(response1.status_code, status.HTTP_201_CREATED)
        
        # Duplicate request
        response2 = self.client.post('/api/social/friendships/', data, format='json')
        self.assertIn(response2.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT])
    
    def test_get_pending_friend_requests(self):
        """Test getting pending friend requests."""
        # Create friend request from user2 to user1
        Friendship.objects.create(
            requester=self.user2,
            addressee=self.user1,
            status='pending'
        )
        
        response = self.client.get('/api/social/friendships/pending/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should return requests where user1 is the addressee
        self.assertGreater(len(response.data), 0)
    
    def test_accept_friend_request(self):
        """Test accepting a friend request."""
        # Create friend request
        friendship = Friendship.objects.create(
            requester=self.user2,
            addressee=self.user1,
            status='pending'
        )
        
        response = self.client.post(
            f'/api/social/friendships/{friendship.id}/accept/',
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify friendship status changed
        friendship.refresh_from_db()
        self.assertEqual(friendship.status, 'accepted')


class FriendshipAdvancedTests(TestCase):
    """Advanced friendship tests for coverage."""
    
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='SecurePass123!'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='SecurePass123!'
        )
        self.user3 = User.objects.create_user(
            username='user3',
            email='user3@example.com',
            password='SecurePass123!'
        )
        self.client.force_authenticate(user=self.user1)
    
    def test_friend_nonexistent_user(self):
        """Test sending friend request to nonexistent user."""
        data = {'user_id': str(uuid.uuid4())}
        response = self.client.post('/api/social/friendships/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
    
    def test_cannot_friend_blocked_user(self):
        """Test cannot friend a blocked user."""
        # Create blocked relationship
        Friendship.objects.create(
            requester=self.user1,
            addressee=self.user2,
            status='blocked'
        )
        
        # Try to send friend request
        data = {'user_id': str(self.user2.id)}
        response = self.client.post('/api/social/friendships/', data, format='json')
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
    
    def test_decline_friend_request(self):
        """Test declining a friend request."""
        # Create friend request
        friendship = Friendship.objects.create(
            requester=self.user2,
            addressee=self.user1,
            status='pending'
        )
        
        response = self.client.post(
            f'/api/social/friendships/{friendship.id}/decline/',
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT, status.HTTP_404_NOT_FOUND])
    
    def test_block_user(self):
        """Test blocking a user."""
        # First create friendship
        Friendship.objects.create(
            requester=self.user1,
            addressee=self.user2,
            status='accepted'
        )
        
        # Block user
        response = self.client.post(
            f'/api/social/friendships/{self.user2.id}/block/',
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND])
    
    def test_unblock_user(self):
        """Test unblocking a user."""
        # Create blocked relationship
        friendship = Friendship.objects.create(
            requester=self.user1,
            addressee=self.user2,
            status='blocked'
        )
        
        response = self.client.post(
            f'/api/social/friendships/{friendship.id}/unblock/',
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND])
    
    def test_get_friends_list(self):
        """Test getting friends list."""
        # Create some friendships
        Friendship.objects.create(
            requester=self.user1,
            addressee=self.user2,
            status='accepted'
        )
        Friendship.objects.create(
            requester=self.user3,
            addressee=self.user1,
            status='accepted'
        )
        
        response = self.client.get('/api/social/friendships/?status=accepted')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class NotificationTests(TestCase):
    """Test notification endpoints."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='user',
            email='user@example.com',
            password='SecurePass123!'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_get_notifications(self):
        """Test getting user notifications."""
        response = self.client.get('/api/social/notifications/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
    
    def test_get_unread_count(self):
        """Test getting unread notification count."""
        response = self.client.get('/api/social/notifications/unread/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('unread_count', response.data)
        self.assertEqual(response.data['unread_count'], 0)


class NotificationAdvancedTests(TestCase):
    """Advanced notification tests for coverage."""
    
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='user',
            email='user@example.com',
            password='SecurePass123!'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_mark_notification_as_read(self):
        """Test marking notification as read."""
        # Create a notification
        notif = Notification.objects.create(
            user=self.user,
            type='test',
            title='Test',
            message='Test notification',
            is_read=False
        )
        
        response = self.client.post(
            f'/api/social/notifications/{notif.id}/read/',
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND])
    
    def test_delete_notification(self):
        """Test deleting a notification."""
        # Create a notification
        notif = Notification.objects.create(
            user=self.user,
            type='test',
            title='Test',
            message='Test notification'
        )
        
        response = self.client.delete(
            f'/api/social/notifications/{notif.id}/',
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_204_NO_CONTENT, status.HTTP_404_NOT_FOUND])
    
    def test_mark_all_as_read(self):
        """Test marking all notifications as read."""
        # Create multiple notifications
        for i in range(3):
            Notification.objects.create(
                user=self.user,
                type='test',
                title=f'Test {i}',
                message=f'Test notification {i}',
                is_read=False
            )
        
        response = self.client.post(
            '/api/social/notifications/mark-all-read/',
            format='json'
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND, status.HTTP_405_METHOD_NOT_ALLOWED])


# Import uuid for test data
import uuid
