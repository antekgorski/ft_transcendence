from django.contrib import admin
from .models import Game, PlayerStats


@admin.register(Game)
class GameAdmin(admin.ModelAdmin):
    """Admin interface for Game model."""
    list_display = ('id', 'game_type', 'player_1', 'player_2', 'winner', 'duration_seconds', 'started_at', 'ended_at')
    list_filter = ('game_type', 'started_at', 'ended_at')
    search_fields = ('player_1__username', 'player_2__username', 'winner__username')
    readonly_fields = ('id', 'started_at', 'ended_at')
    
    fieldsets = (
        ('Game Info', {
            'fields': ('id', 'game_type', 'winner')
        }),
        ('Players', {
            'fields': ('player_1', 'player_2')
        }),
        ('Statistics', {
            'fields': (
                'duration_seconds',
                ('player_1_shots', 'player_1_hits'),
                ('player_2_shots', 'player_2_hits')
            )
        }),
        ('Timestamps', {
            'fields': ('started_at', 'ended_at')
        }),
    )
    
    def has_delete_permission(self, request, obj=None):
        """Only superusers can delete games."""
        return request.user.is_superuser


@admin.register(PlayerStats)
class PlayerStatsAdmin(admin.ModelAdmin):
    """Admin interface for PlayerStats model."""
    list_display = ('user', 'games_played', 'games_won', 'games_lost', 'accuracy_percentage', 'current_win_streak', 'updated_at')
    list_filter = ('updated_at',)
    search_fields = ('user__username', 'user__email')
    readonly_fields = ('id', 'updated_at')
    
    fieldsets = (
        ('Player', {
            'fields': ('id', 'user')
        }),
        ('Game Statistics', {
            'fields': (
                ('games_played', 'games_won', 'games_lost'),
                ('total_shots', 'total_hits', 'accuracy_percentage')
            )
        }),
        ('Streaks & Records', {
            'fields': (
                ('current_win_streak', 'longest_win_streak'),
                'best_game_duration_seconds'
            )
        }),
        ('Timestamps', {
            'fields': ('updated_at',)
        }),
    )
    
    def has_delete_permission(self, request, obj=None):
        """Only superusers can delete player stats."""
        return request.user.is_superuser
