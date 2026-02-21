from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Friendship, Notification
from .serializers import (
    FriendshipSerializer,
    FriendshipCreateSerializer,
    NotificationSerializer,
    NotificationUpdateSerializer,
)
from authentication.models import User


class FriendshipViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing friendships.
    
    Endpoints:
    - GET /api/social/friendships/ - List user's friendships
    - POST /api/social/friendships/ - Send friend request
    - GET /api/social/friendships/{id}/ - Retrieve friendship
    - PATCH /api/social/friendships/{id}/ - Update friendship status
    - DELETE /api/social/friendships/{id}/ - Remove friendship
    - GET /api/social/friendships/requests/pending/ - Get pending requests
    - POST /api/social/friendships/{id}/accept/ - Accept request
    - POST /api/social/friendships/{id}/reject/ - Reject request
    - POST /api/social/friendships/{id}/block/ - Block user
    """
    serializer_class = FriendshipSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def get_queryset(self):
        """Get friendships for current user."""
        user_id = self.request.user.id
        return Friendship.objects.filter(
            Q(requester_id=user_id) | Q(addressee_id=user_id)
        ).order_by('-created_at')
    
    def create(self, request):
        """Send a friend request."""
        serializer = FriendshipCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = request.user
        friend_user_id = serializer.validated_data['user_id']
        
        # Prevent self-friendship
        if user.id == friend_user_id:
            return Response(
                {'error': 'Cannot friend yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if friend exists
        try:
            friend_user = User.objects.get(id=friend_user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if friendship already exists
        existing = Friendship.objects.filter(
            Q(requester=user, addressee=friend_user) |
            Q(requester=friend_user, addressee=user)
        ).first()
        
        if existing:
            if existing.status == 'blocked':
                return Response(
                    {'error': 'Cannot add a blocked user'},
                    status=status.HTTP_409_CONFLICT
                )
            return Response(
                {'error': 'Friendship already exists'},
                status=status.HTTP_409_CONFLICT
            )
        
        # Create friendship request
        friendship = Friendship.objects.create(
            requester=user,
            addressee=friend_user,
            status='pending'
        )
        
        # Create notification for recipient
        Notification.objects.create(
            user=friend_user,
            type='friend_request',
            title='Friend Request',
            message=f'{user.username} sent you a friend request',
            data={
                'friendship_id': str(friendship.id),
                'requester_id': str(user.id),
            },
            action_url=f'/api/social/friendships/{friendship.id}/accept/'
        )
        
        serializer = self.get_serializer(friendship)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending friend requests for current user."""
        user = request.user
        pending_requests = Friendship.objects.filter(
            addressee=user,
            status='pending'
        ).order_by('-created_at')
        
        serializer = self.get_serializer(pending_requests, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def sent(self, request):
        """Get sent friend requests for current user."""
        user = request.user
        sent_requests = Friendship.objects.filter(
            requester=user,
            status='pending'
        ).order_by('-created_at')
        
        serializer = self.get_serializer(sent_requests, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def accepted(self, request):
        """Get accepted friendships for current user."""
        user = request.user
        friendships = Friendship.objects.filter(
            Q(requester=user) | Q(addressee=user),
            status='accepted'
        ).order_by('-updated_at')
        
        serializer = self.get_serializer(friendships, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def accept(self, request, id=None):
        """Accept a friend request."""
        try:
            friendship = Friendship.objects.get(id=id)
        except Friendship.DoesNotExist:
            return Response(
                {'error': 'Friendship not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        # Verify user is the addressee
        if friendship.addressee_id != user.id:
            return Response(
                {'error': 'Only the recipient can accept'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify status is pending
        if friendship.status != 'pending':
            return Response(
                {'error': f'Friendship is {friendship.status}'},
                status=status.HTTP_409_CONFLICT
            )
        
        friendship.status = 'accepted'
        friendship.save(update_fields=['status', 'updated_at'])
        
        # Create notification for requester
        Notification.objects.create(
            user=friendship.requester,
            type='friend_accepted',
            title='Friend Request Accepted',
            message=f'{user.username} accepted your friend request',
            data={
                'friendship_id': str(friendship.id),
            }
        )
        
        serializer = self.get_serializer(friendship)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, id=None):
        """Reject a friend request."""
        try:
            friendship = Friendship.objects.get(id=id)
        except Friendship.DoesNotExist:
            return Response(
                {'error': 'Friendship not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        # Verify user is the addressee
        if friendship.addressee_id != user.id:
            return Response(
                {'error': 'Only the recipient can reject'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify status is pending
        if friendship.status != 'pending':
            return Response(
                {'error': f'Friendship is {friendship.status}'},
                status=status.HTTP_409_CONFLICT
            )
        
        friendship.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'])
    def block(self, request, id=None):
        """Block a user."""
        try:
            friendship = Friendship.objects.get(id=id)
        except Friendship.DoesNotExist:
            return Response(
                {'error': 'Friendship not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        # Verify user is involved in friendship
        if friendship.requester_id != user.id and friendship.addressee_id != user.id:
            return Response(
                {'error': 'User not involved in this friendship'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        friendship.status = 'blocked'
        friendship.save(update_fields=['status', 'updated_at'])
        
        serializer = self.get_serializer(friendship)
        return Response(serializer.data)
    
    def destroy(self, request, id=None):
        """Remove a friendship."""
        try:
            friendship = Friendship.objects.get(id=id)
        except Friendship.DoesNotExist:
            return Response(
                {'error': 'Friendship not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        # Verify user is involved
        if friendship.requester_id != user.id and friendship.addressee_id != user.id:
            return Response(
                {'error': 'User not involved in this friendship'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        friendship.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing notifications.
    
    Endpoints:
    - GET /api/social/notifications/ - List user's notifications
    - GET /api/social/notifications/{id}/ - Retrieve notification
    - PATCH /api/social/notifications/{id}/ - Mark as read
    - DELETE /api/social/notifications/{id}/ - Delete notification
    - POST /api/social/notifications/mark-all-read/ - Mark all as read
    - GET /api/social/notifications/unread/ - Get unread count
    """
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def get_queryset(self):
        """Get notifications for current user."""
        user = self.request.user
        return Notification.objects.filter(user=user).order_by('-created_at')
    
    @action(detail=False, methods=['get'])
    def unread(self, request):
        """Get count of unread notifications."""
        user = request.user
        from django.db.models import Q
        count = Notification.objects.filter(
            user=user,
            is_read=False
        ).filter(
            Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
        ).count()
        
        return Response({'unread_count': count})
    
    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        """Mark all notifications as read."""
        user = request.user
        updated = Notification.objects.filter(
            user=user,
            is_read=False
        ).update(
            is_read=True,
            read_at=timezone.now()
        )
        
        return Response({'updated_count': updated})
    
    def partial_update(self, request, id=None):
        """Mark notification as read."""
        try:
            notification = Notification.objects.get(id=id, user=request.user)
        except Notification.DoesNotExist:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = NotificationUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        is_read = serializer.validated_data['is_read']
        
        if is_read and not notification.is_read:
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=['is_read', 'read_at'])
        
        serializer = self.get_serializer(notification)
        return Response(serializer.data)
    
    def destroy(self, request, id=None):
        """Delete a notification."""
        try:
            notification = Notification.objects.get(id=id, user=request.user)
        except Notification.DoesNotExist:
            return Response(
                {'error': 'Notification not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        notification.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
