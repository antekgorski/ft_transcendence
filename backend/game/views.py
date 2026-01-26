from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Game, PlayerStats
from .serializers import (
from .serializers import (
    GameSerializer,
    GameCreateSerializer,
    GameStatusUpdateSerializer,
    GameMoveSerializer,
    GameEndSerializer,
    PlayerStatsSerializer,
    LeaderboardSerializer,
)
from authentication.models import User
from social.models import Friendship
from .redis_manager import GameStateManager
from .ai_opponent import AIOpponent


class GameViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing games.
    
    REST Endpoints (Setup & Management):
    - GET /api/games/ - List user's games
    - POST /api/games/ - Create new game
    - GET /api/games/{id}/ - Retrieve game details
    - POST /api/games/{id}/accept/ - Accept game invitation
    - POST /api/games/{id}/decline/ - Decline game invitation
    - POST /api/games/{id}/ships/ - Place ships (setup phase only)
    - GET /api/games/{id}/ships/status/ - Check ship placement status
    - POST /api/games/{id}/forfeit/ - Forfeit the game
    - POST /api/games/{id}/end-game/ - End game and save results (when all ships sunk)
    - GET /api/games/active/ - Get user's active game
    - GET /api/games/leaderboard/ - Get global leaderboard
    
    WebSocket Endpoints (Real-time Gameplay):
    - ws://localhost:8080/ws/games/ - Join game and send/receive moves
      Messages: {type: 'join', game_id}, {type: 'game_move', move_type, data}
    """
    serializer_class = GameSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'id'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.redis_manager = GameStateManager()
        self.ai_opponent = AIOpponent()
    
    def get_queryset(self):
        """Get games for the current user."""
        user_id = self.request.user.id
        return Game.objects.filter(
            Q(player_1_id=user_id) | Q(player_2_id=user_id)
        ).order_by('-started_at')
    
    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get the user's current active game."""
        user = request.user
        active_game = Game.objects.filter(
            Q(player_1_id=user.id) | Q(player_2_id=user.id),
            status='active'
        ).first()
        
        if not active_game:
            return Response(
                {'detail': 'No active game'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        serializer = self.get_serializer(active_game)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def leaderboard(self, request):
        """Get global leaderboard."""
        limit = request.query_params.get('limit', 100)
        
        try:
            limit = int(limit)
            if limit > 500:
                limit = 500
        except (ValueError, TypeError):
            limit = 100
        
        stats = PlayerStats.objects.filter(
            user__is_active=True,
            games_played__gt=0
        ).order_by('-games_won', '-accuracy_percentage')[:limit]
        
        leaderboard_data = []
        for idx, stat in enumerate(stats, 1):
            win_rate = (stat.games_won / stat.games_played * 100) if stat.games_played > 0 else 0
            leaderboard_data.append({
                'rank': idx,
                'user_id': stat.user.id,
                'username': stat.user.username,
                'games_played': stat.games_played,
                'games_won': stat.games_won,
                'win_rate': round(win_rate, 2),
                'accuracy_percentage': round(stat.accuracy_percentage, 2),
            })
        
        serializer = LeaderboardSerializer(leaderboard_data, many=True)
        return Response(serializer.data)
    
    def create(self, request):
        """Create a new game."""
        user = request.user
        
        # Check if user is already in an active game
        active_game = Game.objects.filter(
            Q(player_1_id=user.id) | Q(player_2_id=user.id),
            status__in=['pending', 'active']
        ).first()
        
        if active_game:
            return Response(
                {'error': 'User is already in a game'},
                status=status.HTTP_409_CONFLICT
            )
        
        serializer = GameCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        game_type = serializer.validated_data['game_type']
        
        if game_type == 'pvp':
            return self._create_pvp_game(user, serializer.validated_data)
        else:
            return self._create_ai_game(user)
    
    def _create_pvp_game(self, player_1, data):
        """Create a PvP game."""
        opponent_id = data.get('opponent_id')
        
        try:
            opponent = User.objects.get(id=opponent_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'Opponent not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if players are friends
        friendship = Friendship.objects.filter(
            Q(requester=player_1, addressee=opponent) |
            Q(requester=opponent, addressee=player_1),
            status__in=['accepted']
        ).first()
        
        if not friendship:
            return Response(
                {'error': 'Cannot challenge this user. You must be friends.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if opponent is in a game
        opponent_active = Game.objects.filter(
            Q(player_1_id=opponent.id) | Q(player_2_id=opponent.id),
            status__in=['pending', 'active']
        ).exists()
        
        if opponent_active:
            return Response(
                {'error': 'Opponent is currently in a game'},
                status=status.HTTP_409_CONFLICT
            )
        
        # Create game
        game = Game.objects.create(
            player_1=player_1,
            player_2=opponent,
            game_type='pvp',
            status='pending'
        )
        
        # Initialize game state in Redis
        self.redis_manager.create_game(
            game_id=str(game.id),
            player_1_id=str(player_1.id),
            player_2_id=str(opponent.id),
            game_type='pvp'
        )
        
        serializer = self.get_serializer(game)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    def _create_ai_game(self, player_1):
        """Create an AI game."""
        game = Game.objects.create(
            player_1=player_1,
            player_2=None,
            game_type='ai',
            status='active'
        )
        
        # Initialize AI game state in Redis
        self.redis_manager.create_game(
            game_id=str(game.id),
            player_1_id=str(player_1.id),
            player_2_id=None,
            game_type='ai'
        )
        
        # Generate AI's initial board and ships
        ai_board = self.ai_opponent.generate_initial_board()
        self.redis_manager.set_board_state(str(game.id), 'ai', ai_board)
        
        serializer = self.get_serializer(game)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def accept(self, request, id=None):
        """Accept a game invitation."""
        try:
            game = Game.objects.get(id=id)
        except Game.DoesNotExist:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        # Verify user is player_2
        if game.player_2_id != user.id:
            return Response(
                {'error': 'Only the invited player can accept'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify game is pending
        if game.status != 'pending':
            return Response(
                {'error': 'Game is not pending'},
                status=status.HTTP_409_CONFLICT
            )
        
        # Update game status
        game.status = 'active'
        game.save(update_fields=['status'])
        
        # Update Redis game state
        self.redis_manager.set_game_status(str(game.id), 'active')
        self.redis_manager.set_current_turn(str(game.id), str(game.player_1_id))
        
        serializer = self.get_serializer(game)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def decline(self, request, id=None):
        """Decline a game invitation."""
        try:
            game = Game.objects.get(id=id)
        except Game.DoesNotExist:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        # Verify user is player_2
        if game.player_2_id != user.id:
            return Response(
                {'error': 'Only the invited player can decline'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify game is pending
        if game.status != 'pending':
            return Response(
                {'error': 'Game is not pending'},
                status=status.HTTP_409_CONFLICT
            )
        
        # Delete game and Redis state
        self.redis_manager.delete_game(str(game.id))
        game.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'])
    def forfeit(self, request, id=None):
        """Forfeit the game."""
        try:
            game = Game.objects.get(id=id)
        except Game.DoesNotExist:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        # Verify user is in the game
        if game.player_1_id != user.id and game.player_2_id != user.id:
            return Response(
                {'error': 'User not in this game'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify game is active
        if game.status != 'active':
            return Response(
                {'error': 'Game is not active'},
                status=status.HTTP_409_CONFLICT
            )
        
        # Determine winner (opponent)
        winner = game.player_2 if game.player_1_id == user.id else game.player_1
        
        # End game
        game.status = 'forfeited'
        game.winner = winner
        game.ended_at = timezone.now()
        game.duration_seconds = int((game.ended_at - game.started_at).total_seconds())
        game.save()
        
        # Update player stats
        self._update_player_stats(game)
        
        # Update Redis
        self.redis_manager.end_game(str(game.id))
        
        serializer = self.get_serializer(game)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def end_game(self, request, id=None):
        """End a game and save the results.
        
        Called by frontend when game naturally ends (all ships sunk).
        """
        try:
            game = Game.objects.get(id=id)
        except Game.DoesNotExist:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        # Verify user is in the game
        if game.player_1_id != user.id and game.player_2_id != user.id:
            return Response(
                {'error': 'User not in this game'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify game is active
        if game.status != 'active':
            return Response(
                {'error': 'Game is not active'},
                status=status.HTTP_409_CONFLICT
            )
        
        # Validate request data
        serializer = GameEndSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        winner_id = serializer.validated_data['winner_id']
        
        # Verify winner is one of the players
        if winner_id != game.player_1_id and winner_id != game.player_2_id:
            return Response(
                {'error': 'Invalid winner'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            winner = User.objects.get(id=winner_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'Winner not found'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update game with results
        game.status = 'completed'
        game.winner = winner
        game.ended_at = timezone.now()
        game.duration_seconds = int((game.ended_at - game.started_at).total_seconds())
        game.player_1_shots = serializer.validated_data['player_1_shots']
        game.player_1_hits = serializer.validated_data['player_1_hits']
        game.player_2_shots = serializer.validated_data['player_2_shots']
        game.player_2_hits = serializer.validated_data['player_2_hits']
        game.save()
        
        # Update player stats
        self._update_player_stats(game)
        
        # Update Redis
        self.redis_manager.end_game(str(game.id))
        
        response_serializer = self.get_serializer(game)
        return Response(response_serializer.data)
    
    @action(detail=True, methods=['post'])
    def ships(self, request, id=None):
        """Place ships during setup phase (before game starts).
        
        Request body:
        {
            "ship_type": "battleship",
            "positions": [
                {"x": 0, "y": 0},
                {"x": 1, "y": 0},
                {"x": 2, "y": 0},
                {"x": 3, "y": 0}
            ]
        }
        """
        try:
            game = Game.objects.get(id=id)
        except Game.DoesNotExist:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        # Verify user is in the game
        if game.player_1_id != user.id and game.player_2_id != user.id:
            return Response(
                {'error': 'User not in this game'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Ship placement only allowed in pending or active status before gameplay starts
        # (In real implementation, add a 'setup_complete' flag to track when both players placed ships)
        if game.status not in ['pending', 'active']:
            return Response(
                {'error': 'Game is not in setup phase'},
                status=status.HTTP_409_CONFLICT
            )
        
        player_key = 'player_1' if game.player_1_id == user.id else 'player_2'
        
        # Check if player has already placed ships
        existing_ships = self.redis_manager.get_ships(str(game.id), player_key)
        
        if existing_ships:
            return Response(
                {'error': 'Ships already placed for this player'},
                status=status.HTTP_409_CONFLICT
            )
        
        # Validate ship placement data
        ship_type = request.data.get('ship_type')
        positions = request.data.get('positions', [])
        
        if not ship_type or not positions:
            return Response(
                {'error': 'ship_type and positions are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Store ships in Redis
        self.redis_manager.set_ships(
            str(game.id),
            player_key,
            {'type': ship_type, 'positions': positions}
        )
        
        return Response({'status': 'Ships placed successfully'})
    
    @action(detail=True, methods=['get'])
    def ships_status(self, request, id=None):
        """Get ship placement status for both players.
        
        Response:
        {
            "player_1_ready": true/false,
            "player_2_ready": true/false,
            "both_ready": true/false
        }
        """
        try:
            game = Game.objects.get(id=id)
        except Game.DoesNotExist:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        # Verify user is in the game
        if game.player_1_id != user.id and game.player_2_id != user.id:
            return Response(
                {'error': 'User not in this game'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        player_1_ships = self.redis_manager.get_ships(str(game.id), 'player_1')
        player_2_ships = self.redis_manager.get_ships(str(game.id), 'player_2')
        
        player_1_ready = player_1_ships is not None
        player_2_ready = player_2_ships is not None
        
        return Response({
            'player_1_ready': player_1_ready,
            'player_2_ready': player_2_ready,
            'both_ready': player_1_ready and player_2_ready
        })

    
    def _end_game_with_winner(self, game, winner_user):
        """End game with a winner."""
        game.status = 'completed'
        game.winner = winner_user
        game.ended_at = timezone.now()
        game.duration_seconds = int((game.ended_at - game.started_at).total_seconds())
        game.save()
        
        # Update player stats
        self._update_player_stats(game)
        
        # Update Redis
        self.redis_manager.end_game(str(game.id))
        
        serializer = self.get_serializer(game)
        return Response(serializer.data)
    
    def _update_player_stats(self, game):
        """Update player statistics after game completion."""
        # Ensure both players have stats records
        try:
            player_1_stats = PlayerStats.objects.get(user_id=game.player_1_id)
        except PlayerStats.DoesNotExist:
            player_1_stats = PlayerStats.objects.create(user_id=game.player_1_id)
        
        if game.player_2_id:
            try:
                player_2_stats = PlayerStats.objects.get(user_id=game.player_2_id)
            except PlayerStats.DoesNotExist:
                player_2_stats = PlayerStats.objects.create(user_id=game.player_2_id)
        
        # Update stats based on game outcome
        if game.game_type == 'pvp' and game.player_2_id:
            player_1_stats.games_played += 1
            player_2_stats.games_played += 1
            
            # Update total shots and hits
            player_1_stats.total_shots += game.player_1_shots
            player_1_stats.total_hits += game.player_1_hits
            player_2_stats.total_shots += game.player_2_shots
            player_2_stats.total_hits += game.player_2_hits
            
            # Update win/loss and streak
            if game.winner_id == game.player_1_id:
                player_1_stats.games_won += 1
                player_1_stats.current_win_streak += 1
                # Update longest streak if current is higher
                if player_1_stats.current_win_streak > player_1_stats.longest_win_streak:
                    player_1_stats.longest_win_streak = player_1_stats.current_win_streak
                
                player_2_stats.games_lost += 1
                player_2_stats.current_win_streak = 0
            elif game.winner_id == game.player_2_id:
                player_2_stats.games_won += 1
                player_2_stats.current_win_streak += 1
                # Update longest streak if current is higher
                if player_2_stats.current_win_streak > player_2_stats.longest_win_streak:
                    player_2_stats.longest_win_streak = player_2_stats.current_win_streak
                
                player_1_stats.games_lost += 1
                player_1_stats.current_win_streak = 0
            
            # Update best game duration
            if game.duration_seconds > player_1_stats.best_game_duration_seconds:
                player_1_stats.best_game_duration_seconds = game.duration_seconds
            if game.duration_seconds > player_2_stats.best_game_duration_seconds:
                player_2_stats.best_game_duration_seconds = game.duration_seconds
            
            # Update accuracy
            if player_1_stats.total_shots > 0:
                player_1_stats.accuracy_percentage = (player_1_stats.total_hits / player_1_stats.total_shots) * 100
            if player_2_stats.total_shots > 0:
                player_2_stats.accuracy_percentage = (player_2_stats.total_hits / player_2_stats.total_shots) * 100
            
            player_1_stats.save()
            player_2_stats.save()
        elif game.game_type == 'ai':
            player_1_stats.games_played += 1
            
            # Update total shots and hits
            player_1_stats.total_shots += game.player_1_shots
            player_1_stats.total_hits += game.player_1_hits
            
            # Update win/loss and streak
            if game.winner_id == game.player_1_id:
                player_1_stats.games_won += 1
                player_1_stats.current_win_streak += 1
                # Update longest streak if current is higher
                if player_1_stats.current_win_streak > player_1_stats.longest_win_streak:
                    player_1_stats.longest_win_streak = player_1_stats.current_win_streak
            else:
                player_1_stats.games_lost += 1
                player_1_stats.current_win_streak = 0
            
            # Update best game duration
            if game.duration_seconds > player_1_stats.best_game_duration_seconds:
                player_1_stats.best_game_duration_seconds = game.duration_seconds
            
            # Update accuracy
            if player_1_stats.total_shots > 0:
                player_1_stats.accuracy_percentage = (player_1_stats.total_hits / player_1_stats.total_shots) * 100
            
            player_1_stats.save()
