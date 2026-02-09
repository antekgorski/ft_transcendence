import uuid
from datetime import datetime, timezone as dt_timezone
from django.utils import timezone
from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Game, PlayerStats
from .serializers import (
    GameSerializer,
    GameCreateSerializer,
    GameEndSerializer,
    LeaderboardSerializer,
    GameHistorySerializer,
)
from authentication.models import User
from social.models import Friendship
from .redis_manager import GameStateManager
from .ai_opponent import AIOpponent
import logging

logger = logging.getLogger(__name__)


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
        # Define ship configuration: 1x4, 2x3, 3x2, 4x1 (total 10 ships = 20 cells)
        self.SHIP_SIZES = {
            'battleship': 4,    # 1 ship of size 4
            'cruiser': 3,       # 2 ships of size 3
            'destroyer': 2,     # 3 ships of size 2
            'submarine': 1      # 4 ships of size 1
        }
        self.SHIP_COUNT = {
            4: 1,   # 1 battleship
            3: 2,   # 2 cruisers
            2: 3,   # 3 destroyers
            1: 4    # 4 submarines
        }
        self.BOARD_SIZE = 10  # 10x10 board
    
    def _validate_ship_positions(self, positions, ship_type):
        """Validate ship position configuration.
        
        Returns: (is_valid: bool, error_message: str or None)
        """
        # Special case: 'fleet' means all ships bundled together (frontend sends all at once)
        if ship_type == 'fleet':
            # For fleet validation, we just check basic constraints
            return self._validate_fleet_positions(positions)
        
        # Check if ship type is valid
        if ship_type not in self.SHIP_SIZES:
            return False, f"Invalid ship type: {ship_type}"
        
        expected_size = self.SHIP_SIZES[ship_type]
        
        # Check if positions list has correct length
        if len(positions) != expected_size:
            return False, f"{ship_type} must have {expected_size} positions, got {len(positions)}"
        
        # Validate each position is within bounds
        for pos in positions:
            if not isinstance(pos, dict) or 'x' not in pos or 'y' not in pos:
                return False, "Each position must have 'x' and 'y' coordinates"
            
            x, y = pos.get('x'), pos.get('y')
            
            # Check if coordinates are integers
            if not isinstance(x, int) or not isinstance(y, int):
                return False, "Coordinates must be integers"
            
            # Check if within board bounds
            if not (0 <= x < self.BOARD_SIZE and 0 <= y < self.BOARD_SIZE):
                return False, f"Position ({x}, {y}) is out of bounds (board size: {self.BOARD_SIZE}x{self.BOARD_SIZE})"
        
        # Extract coordinates
        coords = [(pos['x'], pos['y']) for pos in positions]
        
        # Check for duplicate positions
        if len(coords) != len(set(coords)):
            return False, "Ship has duplicate positions"
        
        # Check if positions form a straight line (horizontal or vertical)
        x_coords = [pos['x'] for pos in positions]
        y_coords = [pos['y'] for pos in positions]
        
        # Sort coordinates for contiguity check
        # (sorting is handled via x_sorted and y_sorted below)
        
        # Check if horizontal (same y, consecutive x)
        if len(set(y_coords)) == 1:
            x_sorted = sorted(x_coords)
            for i in range(len(x_sorted) - 1):
                if x_sorted[i + 1] - x_sorted[i] != 1:
                    return False, "Ship positions must be contiguous"
        # Check if vertical (same x, consecutive y)
        elif len(set(x_coords)) == 1:
            y_sorted = sorted(y_coords)
            for i in range(len(y_sorted) - 1):
                if y_sorted[i + 1] - y_sorted[i] != 1:
                    return False, "Ship positions must be contiguous"
        else:
            return False, "Ship must be placed horizontally or vertically, not diagonally"
        
        return True, None
    
    def _validate_fleet_positions(self, positions):
        """Validate a complete fleet of ships (all positions bundled together).
        
        Configuration: 1x4 cells, 2x3 cells, 3x2 cells, 4x1 cells (total 10 ships = 20 cells)
        
        Returns: (is_valid: bool, error_message: str or None)
        """
        if not isinstance(positions, list) or len(positions) == 0:
            return False, "Fleet must have at least one ship"
        
        # Check total ships match expected count (1*4 + 2*3 + 3*2 + 4*1 = 20)
        expected_total = 4 + (2 * 3) + (3 * 2) + (4 * 1)
        if len(positions) != expected_total:
            return False, f"Fleet must have {expected_total} positions, got {len(positions)}"
        
        # Validate each position is within bounds
        for pos in positions:
            if not isinstance(pos, dict) or 'x' not in pos or 'y' not in pos:
                return False, "Each position must have 'x' and 'y' coordinates"
            
            x, y = pos.get('x'), pos.get('y')
            
            if not isinstance(x, int) or not isinstance(y, int):
                return False, "Coordinates must be integers"
            
            if not (0 <= x < self.BOARD_SIZE and 0 <= y < self.BOARD_SIZE):
                return False, f"Position ({x}, {y}) is out of bounds (board size: {self.BOARD_SIZE}x{self.BOARD_SIZE})"
        
        # Check for duplicate positions
        coords = [(pos['x'], pos['y']) for pos in positions]
        if len(coords) != len(set(coords)):
            return False, "Fleet has duplicate positions (ships cannot overlap)"
        
        # Check that positions can be grouped into valid ships
        # We need to identify individual ships and validate each
        used = set()
        ships_found = []
        
        for start_pos in coords:
            if start_pos in used:
                continue
            
            # Try to build a ship starting from this position
            ship_coords = self._trace_ship(start_pos, coords, used)
            if ship_coords:
                ships_found.append(ship_coords)
                used.update(ship_coords)
        
        # Check that no ships are adjacent to each other (including diagonally)
        is_valid, error_msg = self._check_ships_adjacent(ships_found)
        if not is_valid:
            return False, error_msg
        
        # Verify we found the right number and sizes of ships
        found_sizes = sorted([len(ship) for ship in ships_found], reverse=True)
        expected_sizes = sorted([4, 3, 3, 2, 2, 2, 1, 1, 1, 1], reverse=True)
        
        if found_sizes != expected_sizes:
            return False, f"Invalid ship configuration. Expected sizes {expected_sizes}, got {found_sizes}"
        
        return True, None
    
    def _trace_ship(self, start_pos, all_coords, used):
        """Trace a ship from a starting position (horizontal or vertical).
        
        Note: When both horizontal and vertical directions have equal length,
        horizontal is preferred. This ensures consistent ship detection when
        loading saved positions. Recommend storing ship orientation explicitly
        in ship data structure to avoid ambiguity.
        
        Returns list of coordinates that form a contiguous line, or None if not found.
        Includes single-cell ships (submarines).
        """
        x, y = start_pos
        
        # Try horizontal direction
        h_ship = [(x, y)]
        for i in range(1, self.BOARD_SIZE):
            if (x, y + i) in all_coords and (x, y + i) not in used:
                h_ship.append((x, y + i))
            else:
                break
        
        # Try vertical direction
        v_ship = [(x, y)]
        for i in range(1, self.BOARD_SIZE):
            if (x + i, y) in all_coords and (x + i, y) not in used:
                v_ship.append((x + i, y))
            else:
                break
        
        # Return the longer ship (prioritize direction with more cells)
        # If equal length, prefer horizontal for consistency
        if len(h_ship) > 1 and len(h_ship) >= len(v_ship):
            return h_ship
        elif len(v_ship) > 1:
            return v_ship
        elif len(h_ship) == 1:
            # Single cell ship (submarine) - valid
            return h_ship
        
        return None
    
    def _check_ships_adjacent(self, ships):
        """Check if any two cells from different ships are adjacent (including diagonally).
        
        Args:
            ships: List of ships, where each ship is a list of (x, y) tuples
        
        Returns: (is_valid: bool, error_message: str or None)
        """
        # Create a mapping of all positions to their ship index
        all_positions = {}
        for ship_idx, ship_coords in enumerate(ships):
            for coord in ship_coords:
                all_positions[coord] = ship_idx
        
        # Check all 8 adjacent directions (orthogonal and diagonal)
        directions = [
            (-1, -1), (-1, 0), (-1, 1),
            (0, -1),           (0, 1),
            (1, -1),  (1, 0),  (1, 1)
        ]
        
        # For each cell, check if any adjacent cell belongs to a different ship
        for (x, y), ship_idx in all_positions.items():
            for dx, dy in directions:
                adjacent_pos = (x + dx, y + dy)
                if adjacent_pos in all_positions and all_positions[adjacent_pos] != ship_idx:
                    return False, "Ships cannot be placed adjacent to each other (including diagonally)"
        
        return True, None
    
    def _check_ship_overlaps(self, existing_ships, new_positions):
        """Check if new ship overlaps with existing ships.
        
        Returns: (is_valid: bool, error_message: str or None)
        """
        if not existing_ships:
            return True, None
        
        # Collect all existing positions
        existing_positions = set()
        if isinstance(existing_ships, list):
            for ship in existing_ships:
                if isinstance(ship, dict) and 'positions' in ship:
                    for pos in ship['positions']:
                        existing_positions.add((pos['x'], pos['y']))
        elif isinstance(existing_ships, dict) and 'positions' in existing_ships:
            for pos in existing_ships['positions']:
                existing_positions.add((pos['x'], pos['y']))
        
        # Check for overlaps
        new_coords = {(pos['x'], pos['y']) for pos in new_positions}
        overlap = existing_positions & new_coords
        
        if overlap:
            return False, f"Ship overlaps with existing ship at positions: {overlap}"
        
        return True, None
    
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
        
        # Check Redis for active game
        active_game_id = self.redis_manager.get_active_game(user.id)
        
        if not active_game_id:
            return Response({'game_id': None, 'active': False})
            
        # Verify game metadata exists
        game_meta = self.redis_manager.get_game_meta(active_game_id)
        if not game_meta:
            # Stale active game reference
            self.redis_manager.remove_active_game(user.id)
            return Response({'game_id': None, 'active': False})
        
        # Construct response similar to what frontend expects
        # Note: We return snake_case keys as that's what DRF serializers typically produce
        return Response({
            'id': game_meta.get('game_id'),
            'player_1': game_meta.get('player_1_id'),
            'player_2': game_meta.get('player_2_id') or None,
            'game_type': game_meta.get('game_type'),
            'status': game_meta.get('status'),
            'created_at': game_meta.get('created_at'),
            'active': True
        })
    
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
        active_game_id = self.redis_manager.get_active_game(user.id)
        
        if active_game_id:
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
        if self.redis_manager.get_active_game(opponent.id):
            return Response(
                {'error': 'Opponent is currently in a game'},
                status=status.HTTP_409_CONFLICT
            )
        
        # Generate ID
        game_id = str(uuid.uuid4())
        
        # Initialize game state in Redis
        self.redis_manager.create_game(
            game_id=game_id,
            player_1_id=str(player_1.id),
            player_2_id=str(opponent.id),
            game_type='pvp',
            player_1_username=player_1.username,
            player_2_username=opponent.username
        )
        
        # Set active game for both players
        self.redis_manager.set_active_game(player_1.id, game_id)
        self.redis_manager.set_active_game(opponent.id, game_id)
        
        return Response({
            'id': game_id,
            'player_1': str(player_1.id),
            'player_2': str(opponent.id),
            'game_type': 'pvp',
            'status': 'pending',
            'created_at': datetime.utcnow().isoformat()
        }, status=status.HTTP_201_CREATED)

    def _extract_ai_ships(self, ai_board):
        """Extract AI ship positions from generated board."""
        ai_ships = {
            'type': 'ai_fleet',
            'positions': []
        }

        if 'ships' in ai_board and isinstance(ai_board['ships'], dict):
            for ship_name, ship_data in ai_board['ships'].items():
                if isinstance(ship_data, dict) and 'positions' in ship_data:
                    positions = ship_data.get('positions', [])
                    if isinstance(positions, list):
                        ai_ships['positions'].extend(positions)
                    else:
                        logger.warning(f"AI ship {ship_name} has invalid positions format: {type(positions)}")
                else:
                    logger.warning(f"AI ship {ship_name} missing positions: {ship_data}")
        else:
            logger.error(f"AI board has invalid or missing ships structure: {ai_board}")

        if not ai_ships['positions']:
            return None

        return ai_ships
    
    def _create_ai_game(self, player_1):
        """Create an AI game."""
        # Get or create the AI opponent user
        ai_user, created = User.objects.get_or_create(
            username='ai_opponent',
            defaults={
                'email': 'ai@system.local',
                'display_name': 'AI Opponent',
                'avatar_url': 'avatars/avatar_1.jpg',
                'is_active': True,
                # Mark AI account as staff to distinguish it from regular users
                'is_staff': True,
                'is_superuser': False,
            }
        )

        # Verify that the retrieved user is the expected dedicated AI account
        expected_username = 'ai_opponent'
        expected_email = 'ai@system.local'
        if (
            ai_user.username != expected_username
            or ai_user.email != expected_email
            or not ai_user.is_staff
        ):
            logger.error(
                "AI user lookup returned an unexpected account (id=%s, username=%s). "
                "Refusing to use it as AI opponent.",
                ai_user.id,
                ai_user.username,
            )
            return Response(
                {'error': 'AI opponent account is misconfigured'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        
        # Set an unusable password for AI user if just created to prevent login with a static password
        if created:
            ai_user.set_unusable_password()
            ai_user.save()
        
        # Generate ID
        game_id = str(uuid.uuid4())
        
        # Initialize AI game state in Redis
        self.redis_manager.create_game(
            game_id=game_id,
            player_1_id=str(player_1.id),
            player_2_id=str(ai_user.id),
            game_type='ai',
            player_1_username=player_1.username,
            player_2_username=ai_user.username
        )
        
        # Set active game for player (AI doesn't need active game check)
        self.redis_manager.set_active_game(player_1.id, game_id)
        
        # Generate AI's initial board and ships
        ai_board = self.ai_opponent.generate_initial_board()
        self.redis_manager.set_board_state(game_id, 'ai', ai_board)
        
        ai_ships = self._extract_ai_ships(ai_board)
        if not ai_ships:
            logger.error(f"Failed to extract AI ship positions from board: {ai_board}")
            # Clean up
            self.redis_manager.delete_game(game_id)
            self.redis_manager.remove_active_game(player_1.id)
            return Response(
                {'error': 'Failed to initialize AI opponent'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        self.redis_manager.set_ships(game_id, 'player_2', ai_ships)
        
        return Response({
            'id': game_id,
            'player_1': str(player_1.id),
            'player_2': str(ai_user.id),
            'game_type': 'ai',
            'status': 'pending',
            'created_at': datetime.utcnow().isoformat()
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    @action(detail=True, methods=['post'])
    def accept(self, request, id=None):
        """Accept a game invitation."""
        game_meta = self.redis_manager.get_game_meta(id)
        if not game_meta:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        # Verify user is player_2
        # Redis stores IDs as strings, so compare as strings
        if game_meta.get('player_2_id') != str(user.id):
            return Response(
                {'error': 'Only the invited player can accept'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify game is pending
        if game_meta.get('status') != 'pending':
            return Response(
                {'error': 'Game is not pending'},
                status=status.HTTP_409_CONFLICT
            )
        
        # Update Redis game status
        self.redis_manager.set_game_status(id, 'active')
        self.redis_manager.set_current_turn(id, game_meta.get('player_1_id'))
        
        # Update metadata in response
        game_meta['status'] = 'active'
        return Response({
            'id': game_meta.get('game_id'),
            'player_1': game_meta.get('player_1_id'),
            'player_2': game_meta.get('player_2_id'),
            'game_type': game_meta.get('game_type'),
            'status': 'active',
            'created_at': game_meta.get('created_at')
        })
    
    @action(detail=True, methods=['post'])
    def decline(self, request, id=None):
        """Decline a game invitation."""
        game_meta = self.redis_manager.get_game_meta(id)
        if not game_meta:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        
        # Verify user is player_2
        if game_meta.get('player_2_id') != str(user.id):
            return Response(
                {'error': 'Only the invited player can decline'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify game is pending
        if game_meta.get('status') != 'pending':
            return Response(
                {'error': 'Game is not pending'},
                status=status.HTTP_409_CONFLICT
            )
        
        # Delete game and Redis state
        self.redis_manager.delete_game(id)
        self.redis_manager.remove_active_game(game_meta.get('player_1_id'))
        self.redis_manager.remove_active_game(user.id)
        
        return Response(status=status.HTTP_204_NO_CONTENT)
    
    @action(detail=True, methods=['post'])
    def forfeit(self, request, id=None):
        """Forfeit the game."""
        game_meta = self.redis_manager.get_game_meta(id)
        if not game_meta:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        player_1_id = game_meta.get('player_1_id')
        player_2_id = game_meta.get('player_2_id')
        
        # Verify user is in the game
        if str(user.id) != player_1_id and str(user.id) != player_2_id:
            return Response(
                {'error': 'User not in this game'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify game is active
        if game_meta.get('status') != 'active':
            return Response(
                {'error': 'Game is not active'},
                status=status.HTTP_409_CONFLICT
            )
        
        # Determine winner (opponent)
        winner_id = player_2_id if str(user.id) == player_1_id else player_1_id
        
        try:
            player_1 = User.objects.get(id=player_1_id)
            player_2 = User.objects.get(id=player_2_id) if player_2_id else None
            winner = User.objects.get(id=winner_id) if winner_id else None
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get stats from Redis
        shots_p1 = self.redis_manager.get_shots(id, 'player_1')
        shots_p2 = self.redis_manager.get_shots(id, 'player_2')
        
        def summarize(shots):
            total = len(shots)
            hits = sum(1 for shot in shots if shot.get('result') == 'hit')
            return total, hits

        p1_shots, p1_hits = summarize(shots_p1)
        p2_shots, p2_hits = summarize(shots_p2)
        
        # Parse created_at as timezone-aware datetime
        started_at_dt = timezone.now()
        created_at_str = game_meta.get('created_at')
        if created_at_str:
            try:
                start_time = datetime.fromisoformat(created_at_str)
                if start_time.tzinfo is None:
                    start_time = start_time.replace(tzinfo=dt_timezone.utc)
                started_at_dt = start_time
            except (ValueError, TypeError):
                pass
        
        # Create completed game record in DB
        game = Game.objects.create(
            id=id,
            player_1=player_1,
            player_2=player_2,
            game_type=game_meta.get('game_type'),
            status='forfeited',
            winner=winner,
            started_at=started_at_dt,
            ended_at=timezone.now(),
            player_1_shots=p1_shots,
            player_1_hits=p1_hits,
            player_2_shots=p2_shots,
            player_2_hits=p2_hits
        )
        
        # Calculate duration
        try:
            created_at_str = game_meta.get('created_at')
            if created_at_str:
                # Redis stores naive UTC datetime (no Z suffix), parse and make timezone-aware
                start_time = datetime.fromisoformat(created_at_str)
                if start_time.tzinfo is None:
                    start_time = start_time.replace(tzinfo=dt_timezone.utc)
                ended_at = game.ended_at
                if ended_at.tzinfo is None:
                    ended_at = ended_at.replace(tzinfo=dt_timezone.utc)
                game.duration_seconds = int((ended_at - start_time).total_seconds())
        except (ValueError, TypeError, AttributeError):
            game.duration_seconds = 0
        game.save()
        
        # Update player stats
        self._update_player_stats(game)
        
        # Cleanup Redis
        self.redis_manager.delete_game(id)
        self.redis_manager.remove_active_game(player_1_id)
        if player_2_id:
            self.redis_manager.remove_active_game(player_2_id)
        
        serializer = self.get_serializer(game)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def end_game(self, request, id=None):
        """End a game and save the results.
        
        Called by frontend when game naturally ends (all ships sunk).
        """
        game_meta = self.redis_manager.get_game_meta(id)
        if not game_meta:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        player_1_id = game_meta.get('player_1_id')
        player_2_id = game_meta.get('player_2_id')
        
        # Verify user is in the game
        if str(user.id) != player_1_id and str(user.id) != player_2_id:
            return Response(
                {'error': 'User not in this game'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Verify game is active
        if game_meta.get('status') != 'active':
            return Response(
                {'error': 'Game is not active'},
                status=status.HTTP_409_CONFLICT
            )
        
        # Validate request data
        serializer = GameEndSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        winner_id = serializer.validated_data['winner_id']
        
        # Verify winner is one of the players
        # winner_id from serializer is UUID, player_ids in Redis are strings
        if str(winner_id) != player_1_id and str(winner_id) != player_2_id:
            return Response(
                {'error': 'Invalid winner'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            player_1 = User.objects.get(id=player_1_id)
            player_2 = User.objects.get(id=player_2_id) if player_2_id else None
            winner = User.objects.get(id=winner_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Get stats from Redis (trust Redis for accuracy over frontend provided stats if possible, 
        # but let's usage serializer data to match original logic or double check)
        # The original logic used serializer data for shots/hits. 
        # But we have authoritative data in Redis. Let's use Redis data for consistency.
        
        shots_p1 = self.redis_manager.get_shots(id, 'player_1')
        shots_p2 = self.redis_manager.get_shots(id, 'player_2')
        
        def summarize(shots):
            total = len(shots)
            hits = sum(1 for shot in shots if shot.get('result') == 'hit')
            return total, hits

        p1_shots, p1_hits = summarize(shots_p1)
        p2_shots, p2_hits = summarize(shots_p2)
        
        # Parse created_at as timezone-aware datetime
        started_at_dt = timezone.now()
        created_at_str = game_meta.get('created_at')
        if created_at_str:
            try:
                start_time = datetime.fromisoformat(created_at_str)
                if start_time.tzinfo is None:
                    start_time = start_time.replace(tzinfo=dt_timezone.utc)
                started_at_dt = start_time
            except (ValueError, TypeError):
                pass
        
        # Create completed game record in DB
        game = Game.objects.create(
            id=id,
            player_1=player_1,
            player_2=player_2,
            game_type=game_meta.get('game_type'),
            status='completed',
            winner=winner,
            started_at=started_at_dt,
            ended_at=timezone.now(),
            player_1_shots=p1_shots,
            player_1_hits=p1_hits,
            player_2_shots=p2_shots,
            player_2_hits=p2_hits
        )
        
        # Calculate duration
        try:
            created_at_str = game_meta.get('created_at')
            if created_at_str:
                # Redis stores naive UTC datetime (no Z suffix), parse and make timezone-aware
                start_time = datetime.fromisoformat(created_at_str)
                if start_time.tzinfo is None:
                    start_time = start_time.replace(tzinfo=dt_timezone.utc)
                ended_at = game.ended_at
                if ended_at.tzinfo is None:
                    ended_at = ended_at.replace(tzinfo=dt_timezone.utc)
                game.duration_seconds = int((ended_at - start_time).total_seconds())
        except (ValueError, TypeError, AttributeError):
            game.duration_seconds = 0
        game.save()
        
        # Update player stats
        self._update_player_stats(game)
        
        # Cleanup Redis
        self.redis_manager.delete_game(id)
        self.redis_manager.remove_active_game(player_1_id)
        if player_2_id:
            self.redis_manager.remove_active_game(player_2_id)
        
        response_serializer = self.get_serializer(game)
        return Response(response_serializer.data)
    
    @action(detail=True, methods=['post'])
    @action(detail=True, methods=['post'])
    def ships(self, request, id=None):
        """Place ships during setup phase (before game starts)."""
        game_meta = self.redis_manager.get_game_meta(id)
        if not game_meta:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        player_1_id = game_meta.get('player_1_id')
        player_2_id = game_meta.get('player_2_id')
        
        # Verify user is in the game
        if str(user.id) != player_1_id and str(user.id) != player_2_id:
            return Response(
                {'error': 'User not in this game'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Ship placement only allowed in pending or active status
        status_val = game_meta.get('status')
        if status_val not in ['pending', 'active']:
            return Response(
                {'error': 'Game is not in setup phase'},
                status=status.HTTP_409_CONFLICT
            )
        
        player_key = 'player_1' if str(user.id) == player_1_id else 'player_2'
        
        # Check if player has already placed ships
        existing_ships = self.redis_manager.get_ships(id, player_key)
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
        
        # Validate ship positions
        is_valid, error_msg = self._validate_ship_positions(positions, ship_type)
        if not is_valid:
            return Response(
                {'error': error_msg},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check for overlaps with existing ships
        is_valid, error_msg = self._check_ship_overlaps(existing_ships, positions)
        if not is_valid:
            return Response(
                {'error': error_msg},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Store ships in Redis
        ship_data = {'type': ship_type, 'positions': positions}
        
        self.redis_manager.set_ships(id, player_key, ship_data)
        
        # For AI games: start game when player_1 finishes ship placement
        if game_meta.get('game_type') == 'ai' and game_meta.get('status') == 'pending' and player_key == 'player_1':
            # Ensure AI ships exist before activating the game
            ai_ships = self.redis_manager.get_ships(id, 'player_2')
            if not ai_ships or not ai_ships.get('positions'):
                try:
                    ai_board = self.ai_opponent.generate_initial_board()
                    # Check if set_board_state expects 'player_2' or 'ai'? 
                    # Usually AI is player_2. The original code used 'ai' as key for set_board_state?
                    # Let's check the garbage code: self.redis_manager.set_board_state(str(game.id), 'ai', ai_board)
                    # And set_ships uses 'player_2'.
                    self.redis_manager.set_board_state(id, 'player_2', ai_board)
                    
                    # We need _extract_ai_ships or similar helper.
                    # Assuming self._extract_ai_ships exists in the class.
                    ai_ships = self._extract_ai_ships(ai_board)
                    if not ai_ships:
                         raise ValueError("Failed to extract AI ships")
                    self.redis_manager.set_ships(id, 'player_2', ai_ships)
                except Exception as e:
                    logger.error(f"AI initialization failed for game {id}: {e}")
                    return Response(
                        {'error': 'AI opponent failed to initialize. Please try again.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR
                    )
            
            # Update Redis game status
            self.redis_manager.set_game_status(id, 'active')
            self.redis_manager.set_current_turn(id, game_meta.get('player_1_id'))
            
        return Response({'status': 'ships_placed'})
    
    @action(detail=True, methods=['get'])
    def ships_status(self, request, id=None):
        """Get ship placement status for both players."""
        game_meta = self.redis_manager.get_game_meta(id)
        if not game_meta:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        player_1_id = game_meta.get('player_1_id')
        player_2_id = game_meta.get('player_2_id')
        game_type = game_meta.get('game_type')
        
        # Verify user is in the game
        if str(user.id) != player_1_id and str(user.id) != player_2_id:
            return Response(
                {'error': 'User not in this game'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        player_1_ships = self.redis_manager.get_ships(id, 'player_1')
        player_2_ships = self.redis_manager.get_ships(id, 'player_2')
        
        # For AI games, player_2 ships are automatically placed
        player_1_ready = player_1_ships is not None
        player_2_ready = player_2_ships is not None or game_type == 'ai'
        
        return Response({
            'player_1_ready': player_1_ready,
            'player_2_ready': player_2_ready,
            'both_ready': player_1_ready and player_2_ready,
            'player_1_ships': player_1_ships,
            'player_2_ships': player_2_ships if game_type != 'ai' else None  # Don't expose AI ships
        })

    @action(detail=True, methods=['get'])
    def shots(self, request, id=None):
        """Get shot history for a game, sorted by timestamp."""
        game_meta = self.redis_manager.get_game_meta(id)
        if not game_meta:
            return Response(
                {'error': 'Game not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        user = request.user
        player_1_id = game_meta.get('player_1_id')
        player_2_id = game_meta.get('player_2_id')
        
        # Verify user is in the game
        if str(user.id) != player_1_id and str(user.id) != player_2_id:
            return Response(
                {'error': 'User not in this game'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        player_1_shots = self.redis_manager.get_shots(id, 'player_1') or []
        player_2_shots = self.redis_manager.get_shots(id, 'player_2') or []
        player_1_inactive = self.redis_manager.get_inactive_cells(id, 'player_1') or []
        player_2_inactive = self.redis_manager.get_inactive_cells(id, 'player_2') or []
        current_turn = self.redis_manager.get_current_turn(id)
        
        # Sort shots by timestamp (Redis returns in reverse order)
        def sort_by_timestamp(shots):
            return sorted(shots, key=lambda s: s.get('timestamp', ''), reverse=False)
        
        return Response({
            'player_1_shots': sort_by_timestamp(player_1_shots),
            'player_2_shots': sort_by_timestamp(player_2_shots),
            'player_1_inactive': player_1_inactive,
            'player_2_inactive': player_2_inactive,
            'current_turn': current_turn
        })

    @action(detail=False, methods=['get'])
    def game_history(self, request):
        """Get the last 10 completed or forfeited games for the current user.
        
        Returns:
        [
            {
                "id": "uuid",
                "opponent_username": "player_name",
                "opponent_avatar_url": "url",
                "game_type": "pvp" or "ai",
                "game_type_display": "PvP" or "AI",
                "result": "win" or "loss",
                "duration_seconds": 1234,
                "ended_at": "2026-02-05T14:30:00Z",
                "player_1_shots": 50,
                "player_1_hits": 25,
                "player_2_shots": 40,
                "player_2_hits": 20
            }, ...
        ]
        """
        user = request.user
        
        # Get the last 10 completed or forfeited games where the user was player_1 or player_2
        games = Game.objects.filter(
            Q(player_1_id=user.id) | Q(player_2_id=user.id),
            status__in=['completed', 'forfeited']
        ).order_by('-ended_at')[:10]
        
        serializer = GameHistorySerializer(games, many=True, context={'request': request})
        return Response(serializer.data)

    
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
                # Track fastest win (shortest game duration for wins only)
                if game.duration_seconds < player_1_stats.best_game_duration_seconds or player_1_stats.best_game_duration_seconds == 0:
                    player_1_stats.best_game_duration_seconds = game.duration_seconds
                
                player_2_stats.games_lost += 1
                player_2_stats.current_win_streak = 0
            elif game.winner_id == game.player_2_id:
                player_2_stats.games_won += 1
                player_2_stats.current_win_streak += 1
                # Update longest streak if current is higher
                if player_2_stats.current_win_streak > player_2_stats.longest_win_streak:
                    player_2_stats.longest_win_streak = player_2_stats.current_win_streak
                # Track fastest win (shortest game duration for wins only)
                if game.duration_seconds < player_2_stats.best_game_duration_seconds or player_2_stats.best_game_duration_seconds == 0:
                    player_2_stats.best_game_duration_seconds = game.duration_seconds
                
                player_1_stats.games_lost += 1
                player_1_stats.current_win_streak = 0
            
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
                # Track fastest win (shortest game duration for wins only)
                if game.duration_seconds < player_1_stats.best_game_duration_seconds or player_1_stats.best_game_duration_seconds == 0:
                    player_1_stats.best_game_duration_seconds = game.duration_seconds
            else:
                player_1_stats.games_lost += 1
                player_1_stats.current_win_streak = 0
            
            # Update accuracy
            if player_1_stats.total_shots > 0:
                player_1_stats.accuracy_percentage = (player_1_stats.total_hits / player_1_stats.total_shots) * 100
            
            player_1_stats.save()
            
    def _extract_ai_ships(self, board):
        """Extract ship positions from AI board grid."""
        ships = {}
        # Board might be a dict with string keys "0".."9" or a list
        is_dict = isinstance(board, dict)
        
        for y in range(10):  # 10x10 grid
            row_key = str(y) if is_dict else y
            if is_dict and row_key not in board:
                continue
                
            row = board[row_key]
            for x in range(10):
                col_key = str(x) if isinstance(row, dict) else x
                # Handle case where row might be list or dict
                if isinstance(row, dict) and col_key not in row:
                    continue
                    
                cell = row[col_key]
                if cell['type'] == 'ship':
                    ship_id = cell['shipId']
                    if ship_id not in ships:
                        ships[ship_id] = []
                    ships[ship_id].append({'x': x, 'y': y})
        
        # Format as expected by game logic
        return {'positions': [pos for ship_pos in ships.values() for pos in ship_pos]}
