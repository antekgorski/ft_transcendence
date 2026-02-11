import uuid
from django.db import models


class Game(models.Model):
    """Game history record."""
    GAME_TYPES = [
        ('pvp', 'Player vs Player'),
        ('ai', 'Player vs AI'),
    ]

    STATUS_CHOICES = [
        ('completed', 'Completed'),
        ('forfeited', 'Forfeited'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player_1 = models.ForeignKey('authentication.User', on_delete=models.CASCADE, related_name='games_as_player1')
    player_2 = models.ForeignKey('authentication.User', on_delete=models.CASCADE, related_name='games_as_player2', null=True, blank=True)
    game_type = models.CharField(max_length=10, choices=GAME_TYPES, default='pvp')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='completed')
    winner = models.ForeignKey('authentication.User', on_delete=models.SET_NULL, related_name='games_won', null=True, blank=True)
    duration_seconds = models.IntegerField(default=0)
    player_1_shots = models.IntegerField(default=0)
    player_1_hits = models.IntegerField(default=0)
    player_2_shots = models.IntegerField(default=0)
    player_2_hits = models.IntegerField(default=0)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'games'
        indexes = [
            models.Index(fields=['winner']),
            models.Index(fields=['started_at']),
            models.Index(fields=['player_1', 'ended_at']),
            models.Index(fields=['player_2', 'ended_at']),
        ]


class PlayerStats(models.Model):
    """Player statistics."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField('authentication.User', on_delete=models.CASCADE, related_name='stats')
    games_played = models.IntegerField(default=0)
    games_won = models.IntegerField(default=0)
    games_lost = models.IntegerField(default=0)
    total_shots = models.IntegerField(default=0)
    total_hits = models.IntegerField(default=0)
    accuracy_percentage = models.FloatField(default=0.0)
    longest_win_streak = models.IntegerField(default=0)
    current_win_streak = models.IntegerField(default=0)
    best_game_duration_seconds = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'player_stats'
