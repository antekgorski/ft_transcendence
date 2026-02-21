from rest_framework import serializers
from .models import Friendship, Notification
from authentication.models import User


class UserSimpleSerializer(serializers.ModelSerializer):
    """Simple user serializer for social responses."""
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'display_name', 'avatar_url', 'created_at']
        read_only_fields = fields

    def get_avatar_url(self, obj):
        """Return avatar URL only if the file actually exists."""
        field = obj.avatar_url
        if field and field.name:
            try:
                if field.storage.exists(field.name):
                    return field.url
            except Exception:
                pass
        return None


class FriendshipSerializer(serializers.ModelSerializer):
    """Serializer for friendship relationships."""
    requester_data = UserSimpleSerializer(source='requester', read_only=True)
    addressee_data = UserSimpleSerializer(source='addressee', read_only=True)
    
    class Meta:
        model = Friendship
        fields = [
            'id',
            'requester',
            'requester_data',
            'addressee',
            'addressee_data',
            'status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'requester_data',
            'addressee_data',
            'created_at',
            'updated_at',
        ]


class FriendshipCreateSerializer(serializers.Serializer):
    """Serializer for creating a friendship request."""
    user_id = serializers.UUIDField()


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for notifications."""
    class Meta:
        model = Notification
        fields = [
            'id',
            'user',
            'type',
            'title',
            'message',
            'data',
            'is_read',
            'read_at',
            'created_at',
            'expires_at',
            'action_url',
        ]
        read_only_fields = [
            'id',
            'user',
            'created_at',
        ]


class NotificationUpdateSerializer(serializers.Serializer):
    """Serializer for updating notification read status."""
    is_read = serializers.BooleanField()
