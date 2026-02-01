from django.contrib import admin
from .models import Friendship, Notification


@admin.register(Friendship)
class FriendshipAdmin(admin.ModelAdmin):
    """Admin interface for Friendship model."""
    list_display = ('id', 'requester', 'addressee', 'status', 'created_at', 'updated_at')
    list_filter = ('status', 'created_at', 'updated_at')
    search_fields = ('requester__username', 'addressee__username')
    readonly_fields = ('id', 'created_at', 'updated_at')
    
    fieldsets = (
        ('Friendship Info', {
            'fields': ('id', 'status')
        }),
        ('Users', {
            'fields': ('requester', 'addressee')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def has_delete_permission(self, request, obj=None):
        """Only superusers can delete friendships."""
        return request.user.is_superuser


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Admin interface for Notification model."""
    list_display = ('id', 'user', 'type', 'title', 'is_read', 'created_at', 'expires_at')
    list_filter = ('type', 'is_read', 'created_at', 'expires_at')
    search_fields = ('user__username', 'title', 'message', 'type')
    readonly_fields = ('id', 'created_at', 'read_at')
    
    fieldsets = (
        ('Notification Info', {
            'fields': ('id', 'user', 'type', 'title')
        }),
        ('Content', {
            'fields': ('message', 'data', 'action_url')
        }),
        ('Status', {
            'fields': ('is_read', 'read_at')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'expires_at')
        }),
    )
    
    def has_delete_permission(self, request, obj=None):
        """Only superusers can delete notifications."""
        return request.user.is_superuser
