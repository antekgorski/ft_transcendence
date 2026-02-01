from django.contrib import admin
from .models import User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'oauth_provider', 'is_active', 'is_staff', 'created_at')
    list_filter = ('oauth_provider', 'is_active', 'is_staff', 'is_superuser', 'created_at')
    search_fields = ('username', 'email', 'display_name')
    readonly_fields = ('id', 'created_at', 'last_login', 'password')
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('id', 'username', 'email', 'display_name', 'avatar_url', 'language')
        }),
        ('Authentication', {
            'fields': ('password', 'oauth_provider', 'oauth_id')
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser')
        }),
        ('Preferences', {
            'fields': ('notification_preferences',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'last_login')
        }),
    )
    
    def has_delete_permission(self, request, obj=None):
        # Only superusers can delete users
        return request.user.is_superuser
