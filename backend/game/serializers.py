from rest_framework import serializers
from .models import Game, PlayerStats
from authentication.models import User


class PlayerStatsSerializer(serializers.ModelSerializer):
    """Serializer for player statistics."""
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = PlayerStats
        fields = [
            'id',
            'username',
            'games_played',
            'games_won',
            'games_lost',
            'total_shots',
            'total_hits',
            'accuracy_percentage',
            'longest_win_streak',
            'current_win_streak',
            'best_game_duration_seconds',
            'updated_at',
        ]
        read_only_fields = fields


class UserSimpleSerializer(serializers.ModelSerializer):
    """Simple user serializer for game responses."""
    class Meta:
        model = User
        fields = ['id', 'username', 'display_name', 'avatar_url']
        read_only_fields = fields


class GameSerializer(serializers.ModelSerializer):
    """Serializer for game data."""
    player_1_username = serializers.CharField(
        source='player_1.username', read_only=True
    )
    player_2_username = serializers.CharField(
        source='player_2.username', read_only=True, allow_null=True
    )
    winner_username = serializers.CharField(
        source='winner.username', read_only=True, allow_null=True
    )
    player_1_data = UserSimpleSerializer(source='player_1', read_only=True)
    player_2_data = UserSimpleSerializer(source='player_2', read_only=True)
    winner_data = UserSimpleSerializer(source='winner', read_only=True)
    
    class Meta:
        model = Game
        fields = [
            'id',
            'player_1',
            'player_1_username',
            'player_1_data',
            'player_2',
            'player_2_username',
            'player_2_data',
            'game_type',
            'status',
            'winner',
            'winner_username',
            'winner_data',
            'duration_seconds',
            'player_1_shots',
            'player_1_hits',
            'player_2_shots',
            'player_2_hits',
            'started_at',
            'ended_at',
        ]
        read_only_fields = [
            'id',
            'player_1_username',
            'player_2_username',
            'winner_username',
            'player_1_data',
            'player_2_data',
            'winner_data',
            'duration_seconds',
            'player_1_shots',
            'player_1_hits',
            'player_2_shots',
            'player_2_hits',
            'started_at',
            'ended_at',
        ]


class GameCreateSerializer(serializers.Serializer):
    """Serializer for creating a game."""
    game_type = serializers.ChoiceField(
        choices=['pvp', 'ai'],
        default='pvp'
    )
    opponent_id = serializers.UUIDField(required=False, allow_null=True)
    
    def validate(self, data):
        """Validate game creation parameters."""
        if data.get('game_type') == 'pvp' and not data.get('opponent_id'):
            raise serializers.ValidationError(
                'opponent_id is required for PvP games'
            )
        return data


class GameStatusUpdateSerializer(serializers.Serializer):
    """Serializer for updating game status."""
    status = serializers.ChoiceField(
        choices=['active', 'completed', 'forfeited']
    )
    winner_id = serializers.UUIDField(required=False, allow_null=True)


class GameMoveSerializer(serializers.Serializer):
    """Serializer for a game move (ship placement or shot)."""
    move_type = serializers.ChoiceField(
        choices=['place_ship', 'fire_shot']
    )
    # For ship placement
    ship_type = serializers.CharField(required=False, allow_blank=True)
    positions = serializers.ListField(
        child=serializers.DictField(
            child=serializers.IntegerField(),
            allow_empty=False
        ),
        required=False
    )
    # For firing
    target = serializers.DictField(
        child=serializers.IntegerField(),
        required=False
    )


class GameEndSerializer(serializers.Serializer):
    """Serializer for ending a game and saving results."""
    winner_id = serializers.UUIDField()
    player_1_shots = serializers.IntegerField(min_value=0)
    player_1_hits = serializers.IntegerField(min_value=0)
    player_2_shots = serializers.IntegerField(min_value=0)
    player_2_hits = serializers.IntegerField(min_value=0)
    reason = serializers.ChoiceField(
        choices=['all_ships_sunk', 'forfeit', 'disconnect_timeout'],
        default='all_ships_sunk'
    )
    
    def validate(self, data):
        """Validate game end data."""
        player_1_shots = data.get('player_1_shots', 0)
        player_1_hits = data.get('player_1_hits', 0)
        player_2_shots = data.get('player_2_shots', 0)
        player_2_hits = data.get('player_2_hits', 0)
        
        if player_1_hits > player_1_shots:
            raise serializers.ValidationError(
                'Player 1 hits cannot exceed shots'
            )
        if player_2_hits > player_2_shots:
            raise serializers.ValidationError(
                'Player 2 hits cannot exceed shots'
            )
        
        return data


class LeaderboardSerializer(serializers.Serializer):
    """Serializer for leaderboard entries."""
    rank = serializers.IntegerField()
    user_id = serializers.UUIDField()
    username = serializers.CharField()
    games_played = serializers.IntegerField()
    games_won = serializers.IntegerField()
    win_rate = serializers.FloatField()
    accuracy_percentage = serializers.FloatField()


class GameHistoryEntrySerializer(serializers.Serializer):
    """Serializer for a single entry in user's game history."""
    id = serializers.UUIDField()
    game_type = serializers.CharField()
    status = serializers.CharField()
    started_at = serializers.DateTimeField(allow_null=True)
    ended_at = serializers.DateTimeField(allow_null=True)
    duration_seconds = serializers.IntegerField(allow_null=True)
    result_for_user = serializers.CharField()
    user_accuracy = serializers.FloatField(allow_null=True)
    opponent_accuracy = serializers.FloatField(allow_null=True)
    opponent = UserSimpleSerializer(allow_null=True)


class GameDetailsPlayerSerializer(serializers.Serializer):
    """Serializer for per-player details in match details."""
    id = serializers.UUIDField(allow_null=True)
    username = serializers.CharField(allow_null=True)
    display_name = serializers.CharField(allow_null=True)
    avatar_url = serializers.CharField(allow_null=True)
    shots = serializers.IntegerField()
    hits = serializers.IntegerField()
    accuracy = serializers.FloatField(allow_null=True)
    is_current_user = serializers.BooleanField()


class GameDetailsSerializer(serializers.Serializer):
    """Serializer for detailed information about a single game for a user."""
    game_id = serializers.UUIDField()
    game_type = serializers.CharField()
    started_at = serializers.DateTimeField()
    ended_at = serializers.DateTimeField(allow_null=True)
    duration_seconds = serializers.IntegerField(allow_null=True)
    duration_formatted = serializers.CharField()
    winner = UserSimpleSerializer(allow_null=True)
    player_1 = GameDetailsPlayerSerializer()
    player_2 = GameDetailsPlayerSerializer(allow_null=True)
    result_for_user = serializers.CharField()

