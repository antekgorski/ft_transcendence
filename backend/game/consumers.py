import asyncio
import json
import random
import time
from datetime import datetime, timezone as dt_timezone
from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
# JWT authentication will be implemented in future - for now use custom auth
# from rest_framework_simplejwt.tokens import AccessToken
from .redis_manager import GameStateManager
from .ai_opponent import AIOpponent

AI_SINK_TAUNTS = [
    "Your fleet is shrinking! 🔥",
    "Another one bites the dust! 💀",
    "That ship won't be missed... by me! 😎",
    "Bullseye! Down she goes! 🎯",
    "Is that all you've got, Captain? 🏴‍☠️",
    "Splash! One less ship to worry about! 💦",
    "I can smell victory already! 🏆",
    "Your admiral would be disappointed! 😏",
    "The ocean claims another vessel! 🌊",
    "Direct hit! Your fleet is crumbling! 💥",
]

AI_PLAYER_SINK_TAUNTS = [
    "Lucky shot! 🍀",
    "You sunk my ship? Inconceivable! 😱",
    "Beginner's luck... 🙄",
    "I'll make you pay for that! 😡",
    "Just a scratch! 🛥️",
    "My calculations were off... slightly. 📉",
    "I let you have that one. 😉",
    "Enjoy it while it lasts! ⏳",
    "Your coordinates were completely random! 🎲",
    "That was my worst ship anyway. 🚢"
]


class GameConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time game events.
    
    Connection URL: ws://domain/ws/games/
    
    Expected initial message:
    {
        "type": "join",
        "game_id": "uuid"
    }
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = None
        self.game_id = None
        self.redis_manager = GameStateManager()
        self.ai_opponent = AIOpponent()
        self.ai_initial_delay = 0.6
        self.ai_chain_delay = 0.6
    
    async def connect(self):
        """Handle WebSocket connection."""
        try:
            # Accept connection first to allow communication with client
            await self.accept()
            
            # Get user from session/auth middleware
            user = self.scope.get("user")
            
            # For development, allow connection and authenticate on join message
            # In production, stricter auth should be enforced
            if user and getattr(user, "is_authenticated", False):
                self.user = user
                # Mark user as online
                await self._mark_user_online()
            else:
                # Don't set user yet; wait for join message with game_id validation
                self.user = None
            
            # Send connection confirmation
            await self.send(json.dumps({
                'type': 'connected',
                'user_id': str(self.user.id) if self.user else None,
                'username': getattr(self.user, 'username', 'Anonymous') if self.user else None,
                'message': 'Connected. Send a join message to authenticate.',
            }))
            
        except Exception as e:
            try:
                await self.close(code=4000)
            except:
                pass
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if self.user:
            # Mark user as offline
            await self._mark_user_offline()
            
            if self.game_id:
                game_meta = self.redis_manager.get_game_meta(self.game_id)
                game_status = game_meta.get('status') if game_meta else None
                
                if game_status == 'active':
                    # Record disconnect and schedule forfeit after 60s grace period
                    self.redis_manager.set_player_disconnected(self.game_id, str(self.user.id))
                    
                    # Notify opponent of disconnection (PvP only)
                    if game_meta and game_meta.get('game_type') == 'pvp':
                        await self.channel_layer.group_send(
                            f"game_{self.game_id}",
                            {
                                'type': 'opponent_disconnected',
                                'disconnected_player_id': str(self.user.id),
                                'reconnect_timeout_seconds': 60,
                            }
                        )
                    
                    asyncio.create_task(self._schedule_disconnect_forfeit(self.game_id, str(self.user.id)))
                # For pending games (ship placement phase), just leave quietly
        
        if self.game_id:
            # Leave game group
            await self.channel_layer.group_discard(
                f"game_{self.game_id}",
                self.channel_name
            )
    
    async def _schedule_disconnect_forfeit(self, game_id, user_id):
        """Give a disconnected player 60 seconds to reconnect before forfeiting.
        Waits 3 seconds first to detect simultaneous disconnects — if both players
        disconnect within this window, the game is erased with no winner.
        After the 3s check, waits the remaining 57 seconds before forfeiting.
        """
        try:
            # Phase 1: 3s window to catch simultaneous disconnects
            await asyncio.sleep(3)

            game_meta = self.redis_manager.get_game_meta(game_id)
            if not game_meta or game_meta.get('status') != 'active':
                return

            # If player already reconnected, nothing to do
            disconnected_at = self.redis_manager.get_player_disconnected(game_id, user_id)
            if not disconnected_at:
                return

            p1 = game_meta.get('player_1_id')
            p2 = game_meta.get('player_2_id')
            other = p2 if user_id == p1 else p1

            other_disconnected = self.redis_manager.get_player_disconnected(game_id, other) if other else None

            if other_disconnected:
                # Both players disconnected simultaneously — erase game, no winner
                self.redis_manager.delete_game(game_id)
                self.redis_manager.remove_active_game(user_id)
                if other:
                    self.redis_manager.remove_active_game(other)
                await self.channel_layer.group_send(
                    f"game_{game_id}",
                    {'type': 'game_ended', 'reason': 'both_disconnected', 'forfeited_by': None, 'winner_id': None}
                )
                return

            # Phase 2: wait the remaining 57 seconds (total 60s grace period)
            await asyncio.sleep(57)

            game_meta = self.redis_manager.get_game_meta(game_id)
            if not game_meta or game_meta.get('status') != 'active':
                return

            # Check if the player has reconnected during the grace period
            disconnected_at = self.redis_manager.get_player_disconnected(game_id, user_id)
            if not disconnected_at:
                return

            # Still disconnected after 60 seconds — forfeit
            await self._finalize_forfeit(user_id, game_id)
            self.redis_manager.delete_game(game_id)
            self.redis_manager.remove_active_game(user_id)
            if other:
                self.redis_manager.remove_active_game(other)
            await self.channel_layer.group_send(
                f"game_{game_id}",
                {'type': 'game_ended', 'reason': 'disconnect', 'forfeited_by': user_id, 'winner_id': other}
            )
        except Exception:
            pass
    
    async def _schedule_placement_timeout(self, game_id, waiting_for_player_id):
        """Cancel a PvP game if the waiting player does not place ships in time."""
        try:
            # Respect the stored timer start so multiple calls don't reset the clock
            existing_start = self.redis_manager.get_placement_timer_start(game_id)
            if existing_start:
                elapsed = time.time() - existing_start
                sleep_for = max(0, 60 - elapsed)
            else:
                sleep_for = 60

            await asyncio.sleep(sleep_for)
            
            game_meta = self.redis_manager.get_game_meta(game_id)
            if not game_meta or game_meta.get('status') != 'pending':
                return
            
            # Check whether the expected player still hasn't placed ships
            p1_id = game_meta.get('player_1_id')
            p2_id = game_meta.get('player_2_id')
            player_key = 'player_1' if waiting_for_player_id == p1_id else 'player_2'
            ships = self.redis_manager.get_ships(game_id, player_key)
            if ships and ships.get('positions'):
                return  # Ships placed in time — game_start already handled activation
            
            # Cancel the game
            self.redis_manager.delete_game(game_id)
            self.redis_manager.remove_active_game(p1_id)
            if p2_id:
                self.redis_manager.remove_active_game(p2_id)
            
            await self.channel_layer.group_send(
                f"game_{game_id}",
                {'type': 'game_cancelled', 'reason': 'placement_timeout'}
            )
        except Exception:
            pass
    
    async def receive(self, text_data):
        """Handle incoming WebSocket messages."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'join':
                await self._handle_join(data)
            elif message_type == 'ping':
                await self._handle_ping(data)
            elif message_type == 'game_move':
                await self._handle_game_move(data)
            elif message_type == 'game_forfeit':
                await self._handle_game_forfeit(data)
            elif message_type == 'chat_message':
                await self._handle_chat_message(data)
            else:
                await self.send_error('Unknown message type')
        
        except json.JSONDecodeError:
            await self.send_error('Invalid JSON')
        except Exception as e:
            await self.send_error(f'Error: {str(e)}')
    
    async def _handle_join(self, data):
        """Join a game room."""
        game_id = data.get('game_id')
        
        if not game_id:
            await self.send_error('game_id is required')
            return
        
        # If user not authenticated yet, try to authenticate from session
        if not self.user:
            user = self.scope.get("user")
            if user and getattr(user, "is_authenticated", False):
                self.user = user
            else:
                await self.send_error('Authentication required to join a game')
                return
        
        # Idempotent join guard
        if self.game_id == game_id:
            return

        # Verify user is in game
        is_valid = await self._verify_user_in_game(game_id)
        if not is_valid:
            # Check if it was a forfeited game due to timeout? Active check handles it.
            # If game gone from Redis, is_valid is False.
            await self.send_error('User not in this game')
            return
        
        # Clear any stale disconnect record (player might reconnect quickly)
        self.redis_manager.clear_player_disconnected(game_id, str(self.user.id))

        self.game_id = game_id

        game_meta = await self._get_game_meta(game_id)
        if game_meta and game_meta.get('game_type') == 'ai':
            self._ensure_ai_ships()
        
        # Join game group
        await self.channel_layer.group_add(
            f"game_{game_id}",
            self.channel_name
        )
        
        # Notify others that player joined
        await self.channel_layer.group_send(
            f"game_{game_id}",
            {
                'type': 'player_joined',
                'player_id': str(self.user.id),
                'username': self.user.username,
            }
        )
        
        # PvP-specific join logic
        if game_meta and game_meta.get('game_type') == 'pvp':
            if game_meta.get('status') == 'active':
                # Game was activated while this player was submitting ships (missed group_send).
                # Send game_start directly so the game can begin on their screen.
                current_turn = self.redis_manager.get_current_turn(game_id)
                await self.send(json.dumps({
                    'type': 'game_start',
                    'starting_player_id': current_turn,
                }))
            elif game_meta.get('status') == 'pending':
                # Reconnect case only: if someone rejoins mid-placement, send them the remaining time
                timer_start = self.redis_manager.get_placement_timer_start(game_id)
                if timer_start:
                    elapsed = time.time() - timer_start
                    remaining = max(0, 60 - int(elapsed))
                    player_key = 'player_1' if str(self.user.id) == game_meta.get('player_1_id') else 'player_2'
                    my_ships = self.redis_manager.get_ships(game_id, player_key)
                    opponent_key = 'player_2' if player_key == 'player_1' else 'player_1'
                    opponent_id = game_meta.get(f'{opponent_key}_id')
                    opponent_ships = self.redis_manager.get_ships(game_id, opponent_key)
                    has_my_ships = bool(my_ships and my_ships.get('positions'))
                    has_opp_ships = bool(opponent_ships and opponent_ships.get('positions'))

                    if has_opp_ships and not has_my_ships:
                        # I'm the one who hasn't placed yet
                        if remaining > 0:
                            await self.send(json.dumps({
                                'type': 'placement_timer_start',
                                'seconds': remaining,
                                'waiting_for_player_id': str(self.user.id),
                            }))
                        else:
                            # Timer already expired — cancel game now
                            p1_id = game_meta.get('player_1_id')
                            p2_id = game_meta.get('player_2_id')
                            self.redis_manager.delete_game(game_id)
                            self.redis_manager.remove_active_game(p1_id)
                            if p2_id:
                                self.redis_manager.remove_active_game(p2_id)
                            await self.channel_layer.group_send(
                                f"game_{game_id}",
                                {'type': 'game_cancelled', 'reason': 'placement_timeout'}
                            )
                    elif has_my_ships and not has_opp_ships:
                        # I placed first and reconnected — resend timer to myself only
                        await self.send(json.dumps({
                            'type': 'placement_timer_start',
                            'seconds': remaining,
                            'waiting_for_player_id': str(opponent_id),
                        }))
    
    async def _handle_ping(self, data):
        """Handle ping/heartbeat."""
        await self._mark_user_online()
        
        await self.send(json.dumps({
            'type': 'pong',
            'timestamp': data.get('timestamp'),
        }))
    
    async def _handle_game_move(self, data):
        """Handle a game move."""
        if not self.game_id:
            await self.send_error('Not in a game')
            return

        if data.get('move_type') != 'shot':
            await self.send_error('Unsupported move type')
            return

        game_meta = await self._get_game_meta(self.game_id)
        if not game_meta:
            await self.send_error('Game not found')
            return

        player_id = str(self.user.id)
        player_key = 'player_1' if player_id == game_meta['player_1_id'] else 'player_2'
        opponent_key = 'player_2' if player_key == 'player_1' else 'player_1'

        row = data.get('data', {}).get('row')
        col = data.get('data', {}).get('col')

        if not isinstance(row, int) or not isinstance(col, int):
            await self.send_error('Invalid shot coordinates')
            return

        if row < 0 or row > 9 or col < 0 or col > 9:
            await self.send_error('Shot out of bounds')
            return

        current_turn = self.redis_manager.get_current_turn(self.game_id)
        if current_turn and current_turn != player_id:
            await self.send_error('Not your turn')
            return

        existing_shots = self.redis_manager.get_shots(self.game_id, player_key)
        if any(s.get('row') == row and s.get('col') == col for s in existing_shots):
            await self.send_error('Already shot at this cell')
            return

        opponent_ships = self.redis_manager.get_ships(self.game_id, opponent_key)
        if (not opponent_ships or not opponent_ships.get('positions')) and game_meta['game_type'] == 'ai' and opponent_key == 'player_2':
            opponent_ships = self._ensure_ai_ships()

        if not opponent_ships or not opponent_ships.get('positions'):
            await self.send_error('Opponent ships not ready')
            return

        hit = any(pos['x'] == row and pos['y'] == col for pos in opponent_ships['positions'])
        result = 'hit' if hit else 'miss'

        pre_sunk = self._get_sunk_ships(opponent_ships, existing_shots)

        shot_record = {
            'row': row,
            'col': col,
            'result': result,
            'timestamp': datetime.utcnow().isoformat(),
        }
        
        # Calculate sunk ships and inactive cells BEFORE storing
        post_sunk = self._get_sunk_ships(opponent_ships, existing_shots + [shot_record])
        newly_sunk = self._find_newly_sunk_ship(pre_sunk, post_sunk)
        inactive_cells = self._get_adjacent_cells(newly_sunk) if newly_sunk else []
        
        # Store shot with inactive cell info if ship was sunk
        if inactive_cells:
            shot_record['inactive'] = inactive_cells
            # Also store inactive cells in a separate Redis set for reliable retrieval on reload
            self.redis_manager.add_inactive_cells(self.game_id, opponent_key, inactive_cells)
        if newly_sunk:
            shot_record['sunk'] = True
            shot_record['sunk_ship'] = newly_sunk
        
        self.redis_manager.add_shot(self.game_id, player_key, shot_record)
        
        move_data = {
            'type': 'game_move',
            'player_id': player_id,
            'move_type': data.get('move_type'),
            'data': {
                'row': row,
                'col': col,
                'result': result,
                'sunk': True if newly_sunk else False,
                'sunk_ship': newly_sunk or [],
                'inactive': inactive_cells,
            },
        }
        
        # Track move in Redis for later retrieval
        await self._record_move(move_data)
        
        # Broadcast to game group
        await self.channel_layer.group_send(
            f"game_{self.game_id}",
            move_data
        )

        # AI taunt when player sinks its ship
        if newly_sunk and opponent_key == 'player_2' and game_meta['game_type'] == 'ai':
            taunt = random.choice(AI_PLAYER_SINK_TAUNTS)
            taunt_timestamp = datetime.utcnow().isoformat()
            self.redis_manager.add_chat_message(self.game_id, game_meta.get('player_2_id', 'ai'), 'AI', taunt, taunt_timestamp)
            await self.channel_layer.group_send(
                f"game_{self.game_id}",
                {
                    'type': 'chat_message',
                    'sender_id': game_meta.get('player_2_id', 'ai'),
                    'sender_username': 'AI',
                    'message': taunt,
                    'timestamp': taunt_timestamp,
                }
            )

        # Check for win condition
        if self._are_all_ships_sunk(opponent_ships, existing_shots + [shot_record]):
            await self.channel_layer.group_send(
                f"game_{self.game_id}",
                {
                    'type': 'game_ended',
                    'winner_id': player_id,
                    'reason': 'all_ships_sunk',
                }
            )
            await self._finalize_game(player_id)
            self.redis_manager.end_game(self.game_id)
            return

        if result == 'miss':
            if opponent_key == 'player_2' and game_meta['game_type'] == 'ai':
                if game_meta.get('player_2_id'):
                    self.redis_manager.set_current_turn(self.game_id, game_meta['player_2_id'])
                # Run AI move in background to allow immediate feedback for miss
                asyncio.create_task(self._handle_ai_move(game_meta))
            else:
                opponent_id = game_meta['player_2_id'] if player_key == 'player_1' else game_meta['player_1_id']
                if opponent_id:
                    self.redis_manager.set_current_turn(self.game_id, opponent_id)
        else:
            # Hit: same player shoots again
            self.redis_manager.set_current_turn(self.game_id, player_id)
    
    async def _handle_game_forfeit(self, data):
        """Handle game forfeit."""
        if not self.game_id:
            await self.send_error('Not in a game')
            return
        
        # Broadcast forfeit to game group
        await self.channel_layer.group_send(
            f"game_{self.game_id}",
            {
                'type': 'game_forfeit',
                'player_id': str(self.user.id),
            }
        )
    
    async def _handle_chat_message(self, data):
        """Handle in-game chat message."""
        if not self.game_id:
            await self.send_error('Not in a game')
            return
        
        message = data.get('message', '').strip()
        if not message:
            return
        
        # Sanitize: limit length
        message = message[:200]
        timestamp = datetime.utcnow().isoformat()
        
        # Store in Redis
        self.redis_manager.add_chat_message(self.game_id, self.user.id, self.user.username, message, timestamp)
        
        # Broadcast to game group
        await self.channel_layer.group_send(
            f"game_{self.game_id}",
            {
                'type': 'chat_message',
                'sender_id': str(self.user.id),
                'sender_username': self.user.username,
                'message': message,
                'timestamp': timestamp,
            }
        )
    
    # Handler methods for group messages
    
    async def player_joined(self, event):
        """Send player_joined event to WebSocket."""
        await self.send(json.dumps({
            'type': 'player_joined',
            'player_id': event['player_id'],
            'username': event['username'],
        }))
    
    async def game_move(self, event):
        """Send game_move event to WebSocket."""
        await self.send(json.dumps({
            'type': 'game_move',
            'player_id': event['player_id'],
            'move_type': event['move_type'],
            'data': event['data'],
        }))
    
    async def game_forfeit(self, event):
        """Send game_forfeit event to WebSocket."""
        await self.send(json.dumps({
            'type': 'game_forfeit',
            'player_id': event['player_id'],
        }))
    
    async def game_ended(self, event):
        """Send game_ended event to WebSocket."""
        await self.send(json.dumps({
            'type': 'game_ended',
            'winner_id': event['winner_id'],
            'reason': event['reason'],
        }))
    
    async def opponent_disconnected(self, event):
        """Notify the remaining player that their opponent disconnected."""
        await self.send(json.dumps({
            'type': 'opponent_disconnected',
            'disconnected_player_id': event['disconnected_player_id'],
        }))
    
    async def game_start(self, event):
        """Notify both players that the game has started (both ships placed)."""
        await self.send(json.dumps({
            'type': 'game_start',
            'starting_player_id': event['starting_player_id'],
        }))

    async def placement_timer_start(self, event):
        """Forward placement_timer_start event to WebSocket client.
        If this consumer belongs to the player who just placed first, start the 60s cleanup task.
        """
        await self.send(json.dumps({
            'type': 'placement_timer_start',
            'seconds': event.get('seconds', 60),
            'waiting_for_player_id': event.get('waiting_for_player_id'),
        }))
        # Only the player who placed first (placed_by_player_id) starts the asyncio timeout
        if self.user and self.game_id and str(self.user.id) == event.get('placed_by_player_id'):
            asyncio.create_task(self._schedule_placement_timeout(
                self.game_id,
                event.get('waiting_for_player_id')
            ))

    async def game_cancelled(self, event):
        """Notify players that the game was cancelled (placement timeout or both left)."""
        await self.send(json.dumps({
            'type': 'game_cancelled',
            'reason': event.get('reason', 'cancelled'),
        }))
    
    async def chat_message(self, event):
        """Send chat_message event to WebSocket."""
        await self.send(json.dumps({
            'type': 'chat_message',
            'sender_id': event['sender_id'],
            'sender_username': event['sender_username'],
            'message': event['message'],
            'timestamp': event['timestamp'],
        }))
    
    async def friend_online(self, event):
        """Send friend online notification."""
        await self.send(json.dumps({
            'type': 'friend_online',
            'user_id': event['user_id'],
            'username': event['username'],
        }))
    
    async def friend_offline(self, event):
        """Send friend offline notification."""
        await self.send(json.dumps({
            'type': 'friend_offline',
            'user_id': event['user_id'],
        }))
    
    async def notification(self, event):
        """Send generic notification."""
        await self.send(json.dumps({
            'type': 'notification',
            'notification_type': event['notification_type'],
            'title': event.get('title'),
            'message': event.get('message'),
            'data': event.get('data', {}),
        }))
    
    # Utility methods
    
    async def send_error(self, message):
        """Send error message to client."""
        await self.send(json.dumps({
            'type': 'error',
            'message': message,
        }))
    
    async def _record_move(self, move_data):
        """Record a move in Redis for game state tracking."""
        try:
            game_key = f"game:{self.game_id}"
            player_id = move_data.get('player_id')
            move_type = move_data.get('move_type')
            
            # Record move in Redis moves list
            move_record = json.dumps({
                'player_id': player_id,
                'move_type': move_type,
                'data': move_data.get('data', {}),
                'timestamp': datetime.utcnow().isoformat(),
            })
            self.redis_manager.redis_client.lpush(
                f"{game_key}:moves",
                move_record
            )
        except Exception as e:
            # Log but don't fail - move should still be broadcast
            pass

    async def _get_game_meta(self, game_id):
        game_meta = self.redis_manager.get_game_meta(game_id)
        if not game_meta:
            return None
        return game_meta

    def _are_all_ships_sunk(self, ships_data, shots):
        if not ships_data or not ships_data.get('positions'):
            return False

        hit_coords = {
            (shot.get('row'), shot.get('col'))
            for shot in shots
            if shot.get('result') == 'hit'
        }

        return all(
            (pos['x'], pos['y']) in hit_coords
            for pos in ships_data.get('positions', [])
        )

    def _get_ship_clusters(self, positions):
        if not positions:
            return []

        coords = {(pos['x'], pos['y']) for pos in positions}
        clusters = []
        visited = set()

        for coord in coords:
            if coord in visited:
                continue
            stack = [coord]
            cluster = []
            visited.add(coord)
            while stack:
                x, y = stack.pop()
                cluster.append({'row': x, 'col': y})
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if (nx, ny) in coords and (nx, ny) not in visited:
                        visited.add((nx, ny))
                        stack.append((nx, ny))
            clusters.append(cluster)
        return clusters

    def _get_remaining_ship_sizes(self, ships_data, shots):
        if not ships_data or not ships_data.get('positions'):
            return []

        clusters = self._get_ship_clusters(ships_data.get('positions', []))
        sizes = [len(cluster) for cluster in clusters]
        sunk = self._get_sunk_ships(ships_data, shots)
        for ship in sunk:
            size = len(ship)
            if size in sizes:
                sizes.remove(size)
        return sizes

    def _get_sunk_ships(self, ships_data, shots):
        if not ships_data or not ships_data.get('positions'):
            return []

        clusters = self._get_ship_clusters(ships_data.get('positions', []))
        hit_coords = {
            (shot.get('row'), shot.get('col'))
            for shot in shots
            if shot.get('result') == 'hit'
        }

        sunk = []
        for cluster in clusters:
            if all((pos['row'], pos['col']) in hit_coords for pos in cluster):
                sunk.append(cluster)
        return sunk

    def _find_newly_sunk_ship(self, pre_sunk, post_sunk):
        pre_sets = {frozenset((pos['row'], pos['col']) for pos in ship) for ship in pre_sunk}
        for ship in post_sunk:
            ship_set = frozenset((pos['row'], pos['col']) for pos in ship)
            if ship_set not in pre_sets:
                return ship
        return None

    def _get_adjacent_cells(self, ship_positions):
        if not ship_positions:
            return []

        ship_set = {(pos['row'], pos['col']) for pos in ship_positions}
        adjacent = set()
        for pos in ship_positions:
            row, col = pos['row'], pos['col']
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = row + dx, col + dy
                    if 0 <= nx < 10 and 0 <= ny < 10 and (nx, ny) not in ship_set:
                        adjacent.add((nx, ny))
        return [{'row': r, 'col': c} for r, c in sorted(adjacent)]

    def _select_ai_target(self, player_ships, ai_shots):
        shots_set = {(shot.get('row'), shot.get('col')) for shot in ai_shots}
        sunk_ships = self._get_sunk_ships(player_ships, ai_shots)
        inactive_cells = set()
        for ship in sunk_ships:
            for cell in self._get_adjacent_cells(ship):
                inactive_cells.add((cell['row'], cell['col']))

        hit_cells = [
            (shot.get('row'), shot.get('col'))
            for shot in ai_shots
            if shot.get('result') == 'hit'
        ]
        sunk_cells = {
            (pos['row'], pos['col'])
            for ship in sunk_ships
            for pos in ship
        }
        active_hits = [cell for cell in hit_cells if cell not in sunk_cells]

        def available(cell):
            row, col = cell
            return 0 <= row < 10 and 0 <= col < 10 and cell not in shots_set and cell not in inactive_cells

        candidates = []
        remaining_sizes = self._get_remaining_ship_sizes(player_ships, ai_shots)

        def placement_valid(cells):
            for r, c in cells:
                if (r, c) in shots_set or (r, c) in inactive_cells:
                    return False
            return True

        def hits_match(cells):
            if not active_hits:
                return True
            if len(active_hits) == 1:
                return active_hits[0] in cells
            rows = {r for r, _ in active_hits}
            cols = {c for _, c in active_hits}
            if len(rows) == 1:
                return all((r, c) in cells for r, c in active_hits)
            if len(cols) == 1:
                return all((r, c) in cells for r, c in active_hits)
            return False

        heatmap = [[0 for _ in range(10)] for _ in range(10)]
        for size in remaining_sizes:
            for r in range(10):
                for c in range(10):
                    if c + size <= 10:
                        cells = [(r, c + i) for i in range(size)]
                        if placement_valid(cells) and hits_match(cells):
                            for cell in cells:
                                heatmap[cell[0]][cell[1]] += 1
                    if r + size <= 10:
                        cells = [(r + i, c) for i in range(size)]
                        if placement_valid(cells) and hits_match(cells):
                            for cell in cells:
                                heatmap[cell[0]][cell[1]] += 1

        best_score = 0
        best_cells = []
        for r in range(10):
            for c in range(10):
                if not available((r, c)):
                    continue
                score = heatmap[r][c]
                if score > best_score:
                    best_score = score
                    best_cells = [(r, c)]
                elif score == best_score and score > 0:
                    best_cells.append((r, c))

        if best_cells:
            target = random.choice(best_cells)
            return {'x': target[0], 'y': target[1]}

        # If no heatmap candidates, try adjacent to any active hit
        if active_hits:
            for r, c in active_hits:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    cell = (r + dx, c + dy)
                    if available(cell):
                        candidates.append(cell)

        if candidates:
            target = random.choice(candidates)
            return {'x': target[0], 'y': target[1]}

        # Fall back to any available cell
        remaining = [
            (r, c)
            for r in range(10)
            for c in range(10)
            if (r, c) not in shots_set and (r, c) not in inactive_cells
        ]
        if remaining:
            target = random.choice(remaining)
            return {'x': target[0], 'y': target[1]}

        return None

    def _ensure_ai_ships(self):
        ai_ships = self.redis_manager.get_ships(self.game_id, 'player_2')
        if ai_ships and ai_ships.get('positions'):
            return ai_ships

        ai_board = self.redis_manager.get_board_state(self.game_id, 'ai')
        if not ai_board:
            ai_board = self.ai_opponent.generate_initial_board()
            self.redis_manager.set_board_state(self.game_id, 'ai', ai_board)

        extracted = self._extract_ai_ships(ai_board)
        if extracted and extracted.get('positions'):
            self.redis_manager.set_ships(self.game_id, 'player_2', extracted)
            return extracted

        return None

    def _extract_ai_ships(self, ai_board):
        ai_ships = {
            'type': 'ai_fleet',
            'positions': [],
        }

        ships = ai_board.get('ships') if isinstance(ai_board, dict) else None
        if not isinstance(ships, dict):
            return None

        for _, ship_data in ships.items():
            if isinstance(ship_data, dict):
                positions = ship_data.get('positions')
                if isinstance(positions, list):
                    ai_ships['positions'].extend(positions)

        if not ai_ships['positions']:
            return None

        return ai_ships

    async def _handle_ai_move(self, game_meta):
        """Handle AI opponent move."""
        try:
            player_ships = self.redis_manager.get_ships(self.game_id, 'player_1')
            if not player_ships or not player_ships.get('positions'):
                return

            ai_shots = self.redis_manager.get_shots(self.game_id, 'player_2')

            while True:
                target = self._select_ai_target(player_ships, ai_shots)
                if not target:
                    if game_meta.get('player_1_id'):
                        self.redis_manager.set_current_turn(self.game_id, game_meta['player_1_id'])
                    return

                row = target.get('x')
                col = target.get('y')

                if not isinstance(row, int) or not isinstance(col, int):
                    if game_meta.get('player_1_id'):
                        self.redis_manager.set_current_turn(self.game_id, game_meta['player_1_id'])
                    return

                if row < 0 or row > 9 or col < 0 or col > 9:
                    if game_meta.get('player_1_id'):
                        self.redis_manager.set_current_turn(self.game_id, game_meta['player_1_id'])
                    return

                if any(s.get('row') == row and s.get('col') == col for s in ai_shots):
                    return

                pre_sunk = self._get_sunk_ships(player_ships, ai_shots)

                hit = any(pos['x'] == row and pos['y'] == col for pos in player_ships['positions'])
                result = 'hit' if hit else 'miss'

                shot_record = {
                    'row': row,
                    'col': col,
                    'result': result,
                    'timestamp': datetime.utcnow().isoformat(),
                }
                
                # Calculate sunk ships first to prepare metadata
                ai_shots_with_current = ai_shots + [shot_record] if ai_shots else [shot_record]
                post_sunk = self._get_sunk_ships(player_ships, ai_shots_with_current)
                newly_sunk = self._find_newly_sunk_ship(pre_sunk, post_sunk)
                inactive_cells = self._get_adjacent_cells(newly_sunk) if newly_sunk else []
                
                # Update shot record with metadata
                if inactive_cells:
                    shot_record['inactive'] = inactive_cells
                    # Also store inactive cells in a separate Redis set for reliable retrieval on reload
                    self.redis_manager.add_inactive_cells(self.game_id, 'player_1', inactive_cells)
                if newly_sunk:
                    shot_record['sunk'] = True
                    shot_record['sunk_ship'] = newly_sunk
                
                self.redis_manager.add_shot(self.game_id, 'player_2', shot_record)
                ai_shots.append(shot_record)

                # AI taunt on sinking a ship
                if newly_sunk:
                    taunt = random.choice(AI_SINK_TAUNTS)
                    taunt_timestamp = datetime.utcnow().isoformat()
                    self.redis_manager.add_chat_message(self.game_id, game_meta.get('player_2_id', 'ai'), 'AI', taunt, taunt_timestamp)
                    await self.channel_layer.group_send(
                        f"game_{self.game_id}",
                        {
                            'type': 'chat_message',
                            'sender_id': game_meta.get('player_2_id', 'ai'),
                            'sender_username': 'AI',
                            'message': taunt,
                            'timestamp': taunt_timestamp,
                        }
                    )

                move_data = {
                    'type': 'game_move',
                    'player_id': game_meta['player_2_id'],
                    'move_type': 'shot',
                    'data': {
                        'row': row,
                        'col': col,
                        'result': result,
                        'sunk': True if newly_sunk else False,
                        'sunk_ship': newly_sunk or [],
                        'inactive': inactive_cells,
                    },
                }

                await self._record_move(move_data)
                await self.channel_layer.group_send(
                    f"game_{self.game_id}",
                    move_data
                )

                if self._are_all_ships_sunk(player_ships, ai_shots):
                    await self.channel_layer.group_send(
                        f"game_{self.game_id}",
                        {
                            'type': 'game_ended',
                            'winner_id': game_meta['player_2_id'],
                            'reason': 'all_ships_sunk',
                        }
                    )
                    await self._finalize_game(game_meta['player_2_id'])
                    self.redis_manager.end_game(self.game_id)
                    return

                if result == 'miss':
                    if game_meta.get('player_1_id'):
                        self.redis_manager.set_current_turn(self.game_id, game_meta['player_1_id'])
                    return

                await asyncio.sleep(self.ai_chain_delay)
                
                # Hit! AI takes another shot (recursively)
                await self._handle_ai_move(game_meta)
                return # Important to break loop after recursive call to avoid double execution if it returns (though it shouldn't reach here due to await)
                
        except Exception as e:
            # Log error but don't crash connection
            print(f"Error in AI move: {e}")
            await self.send_error("AI Opponent Error")
            # Return turn to player to unblock game
            if game_meta and game_meta.get('player_1_id'):
                self.redis_manager.set_current_turn(self.game_id, game_meta['player_1_id'])

    @database_sync_to_async
    def _finalize_game(self, winner_id):
        from game.models import Game, PlayerStats
        from authentication.models import User

        # Check if game already exists (to avoid duplicate creation if called multiple times)
        if Game.objects.filter(id=self.game_id).exists():
            return

        game_meta = self.redis_manager.get_game_meta(self.game_id)
        if not game_meta:
            return

        shots_p1 = self.redis_manager.get_shots(self.game_id, 'player_1')
        shots_p2 = self.redis_manager.get_shots(self.game_id, 'player_2')

        def summarize(shots):
            total = len(shots)
            hits = sum(1 for shot in shots if shot.get('result') == 'hit')
            return total, hits

        p1_shots, p1_hits = summarize(shots_p1)
        p2_shots, p2_hits = summarize(shots_p2)
        
        player_1_id = game_meta.get('player_1_id')
        player_2_id = game_meta.get('player_2_id')
        game_type = game_meta.get('game_type')
        created_at_str = game_meta.get('created_at')
        
        try:
            player_1 = User.objects.get(id=player_1_id)
            player_2 = User.objects.get(id=player_2_id) if player_2_id else None
            winner = User.objects.get(id=winner_id) if winner_id else None
        except User.DoesNotExist:
            return

        # Parse created_at as timezone-aware datetime
        started_at_dt = timezone.now()
        if created_at_str:
            try:
                start_time = datetime.fromisoformat(created_at_str)
                if start_time.tzinfo is None:
                    start_time = start_time.replace(tzinfo=dt_timezone.utc)
                started_at_dt = start_time
            except (ValueError, TypeError):
                pass

        # Create completed game record
        game = Game.objects.create(
            id=self.game_id,
            player_1=player_1,
            player_2=player_2,
            game_type=game_type,
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
            if created_at_str:
                # Redis stores naive UTC datetime (no Z suffix), parse and make timezone-aware
                start_time = datetime.fromisoformat(created_at_str)
                if start_time.tzinfo is None:
                    start_time = start_time.replace(tzinfo=dt_timezone.utc)
                # Ensure ended_at is timezone-aware
                ended_at = game.ended_at
                if ended_at.tzinfo is None:
                    ended_at = ended_at.replace(tzinfo=dt_timezone.utc)
                game.duration_seconds = int((ended_at - start_time).total_seconds())
        except (ValueError, TypeError) as e:
            pass
        game.save()

        def get_stats(user_id):
            stats, _ = PlayerStats.objects.get_or_create(user_id=user_id)
            return stats

        player_1_stats = get_stats(game.player_1_id)
        player_2_stats = get_stats(game.player_2_id) if game.player_2_id else None

        if game.game_type == 'pvp' and player_2_stats:
            player_1_stats.games_played += 1
            player_2_stats.games_played += 1

            player_1_stats.total_shots += game.player_1_shots
            player_1_stats.total_hits += game.player_1_hits
            player_2_stats.total_shots += game.player_2_shots
            player_2_stats.total_hits += game.player_2_hits

            if game.winner_id == game.player_1_id:
                player_1_stats.games_won += 1
                player_1_stats.current_win_streak += 1
                if player_1_stats.current_win_streak > player_1_stats.longest_win_streak:
                    player_1_stats.longest_win_streak = player_1_stats.current_win_streak
                if game.duration_seconds < player_1_stats.best_game_duration_seconds or player_1_stats.best_game_duration_seconds == 0:
                    player_1_stats.best_game_duration_seconds = game.duration_seconds

                player_2_stats.games_lost += 1
                player_2_stats.current_win_streak = 0
            elif game.winner_id == game.player_2_id:
                player_2_stats.games_won += 1
                player_2_stats.current_win_streak += 1
                if player_2_stats.current_win_streak > player_2_stats.longest_win_streak:
                    player_2_stats.longest_win_streak = player_2_stats.current_win_streak
                if game.duration_seconds < player_2_stats.best_game_duration_seconds or player_2_stats.best_game_duration_seconds == 0:
                    player_2_stats.best_game_duration_seconds = game.duration_seconds

                player_1_stats.games_lost += 1
                player_1_stats.current_win_streak = 0

            if player_1_stats.total_shots > 0:
                player_1_stats.accuracy_percentage = (player_1_stats.total_hits / player_1_stats.total_shots) * 100
            if player_2_stats.total_shots > 0:
                player_2_stats.accuracy_percentage = (player_2_stats.total_hits / player_2_stats.total_shots) * 100

            player_1_stats.save()
            player_2_stats.save()
        else:
            # AI game - only update player_1_stats
            player_1_stats.games_played += 1
            player_1_stats.total_shots += game.player_1_shots
            player_1_stats.total_hits += game.player_1_hits

            if game.winner_id == game.player_1_id:
                player_1_stats.games_won += 1
                player_1_stats.current_win_streak += 1
                if player_1_stats.current_win_streak > player_1_stats.longest_win_streak:
                    player_1_stats.longest_win_streak = player_1_stats.current_win_streak
                if game.duration_seconds < player_1_stats.best_game_duration_seconds or player_1_stats.best_game_duration_seconds == 0:
                    player_1_stats.best_game_duration_seconds = game.duration_seconds
            else:
                player_1_stats.games_lost += 1
                player_1_stats.current_win_streak = 0

            if player_1_stats.total_shots > 0:
                player_1_stats.accuracy_percentage = (player_1_stats.total_hits / player_1_stats.total_shots) * 100

            player_1_stats.save()
        
        # Cleanup active game mappings
        self.redis_manager.remove_active_game(str(player_1_id))
        if player_2_id:
            self.redis_manager.remove_active_game(str(player_2_id))

    def _get_user_from_token(self):
        """
        Resolve the authenticated user for this WebSocket connection.

        Uses the user attached to the connection scope by the
        authentication middleware (e.g., AuthMiddlewareStack).
        """
        # If Django Channels' AuthMiddlewareStack is in use, the authenticated
        # user (or an AnonymousUser) will be available on self.scope["user"].
        user = self.scope.get("user")
        if user is not None and getattr(user, "is_authenticated", False):
            return user
        # Fallback: no authenticated user available
        return None
    
    async def _verify_user_in_game(self, game_id):
        """Verify user is actually in the game."""
        game_meta = self.redis_manager.get_game_meta(game_id)
        if not game_meta:
            return False
            
        player_1_id = game_meta.get('player_1_id')
        player_2_id = game_meta.get('player_2_id')
        
        return str(self.user.id) == player_1_id or str(self.user.id) == player_2_id
    
    async def _mark_user_online(self):
        """Mark user as online in Redis."""
        if self.user:
            self.redis_manager.set_user_online(str(self.user.id))
    
    async def _mark_user_offline(self):
        """Mark user as offline in Redis."""
        if self.user:
            self.redis_manager.set_user_offline(str(self.user.id))
    
    # _set_grace_period removed: reconnection grace period replaced by immediate forfeit


    @database_sync_to_async
    def _finalize_forfeit(self, forfeiting_user_id, game_id):
        from game.models import Game, PlayerStats
        from authentication.models import User
        
        # Check if game already exists
        if Game.objects.filter(id=game_id).exists():
            return

        game_meta = self.redis_manager.get_game_meta(game_id)
        if not game_meta:
            return
            
        player_1_id = game_meta.get('player_1_id')
        player_2_id = game_meta.get('player_2_id')
        game_type = game_meta.get('game_type')
        created_at_str = game_meta.get('created_at')
        
        # Determine winner (the one who didn't forfeit)
        winner_id = player_2_id if forfeiting_user_id == player_1_id else player_1_id
        
        shots_p1 = self.redis_manager.get_shots(game_id, 'player_1')
        shots_p2 = self.redis_manager.get_shots(game_id, 'player_2')

        def summarize(shots):
            total = len(shots)
            hits = sum(1 for shot in shots if shot.get('result') == 'hit')
            return total, hits

        p1_shots, p1_hits = summarize(shots_p1)
        p2_shots, p2_hits = summarize(shots_p2)
        
        try:
            player_1 = User.objects.get(id=player_1_id)
            player_2 = User.objects.get(id=player_2_id) if player_2_id else None
            winner = User.objects.get(id=winner_id) if winner_id else None
        except User.DoesNotExist:
            return

        # Create forfeited game record
        # Parse created_at as timezone-aware datetime
        started_at_dt = timezone.now()
        if created_at_str:
            try:
                start_time = datetime.fromisoformat(created_at_str)
                if start_time.tzinfo is None:
                    start_time = start_time.replace(tzinfo=dt_timezone.utc)
                started_at_dt = start_time
            except (ValueError, TypeError):
                # If the timestamp is malformed, fall back to the current time.
                started_at_dt = timezone.now()
        
        game = Game.objects.create(
            id=game_id,
            player_1=player_1,
            player_2=player_2,
            game_type=game_type,
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
            if created_at_str:
                # Redis stores naive UTC datetime (no Z suffix), parse and make timezone-aware
                start_time = datetime.fromisoformat(created_at_str)
                if start_time.tzinfo is None:
                    start_time = start_time.replace(tzinfo=dt_timezone.utc)
                ended_at = game.ended_at
                if ended_at.tzinfo is None:
                    ended_at = ended_at.replace(tzinfo=dt_timezone.utc)
                game.duration_seconds = int((ended_at - start_time).total_seconds())
        except (ValueError, TypeError):
            pass
        game.save()

        def get_stats(user_id):
            stats, _ = PlayerStats.objects.get_or_create(user_id=user_id)
            return stats

        player_1_stats = get_stats(game.player_1_id)
        player_2_stats = get_stats(game.player_2_id) if game.player_2_id else None
        
        if game.game_type == 'pvp' and player_2_stats:
            player_1_stats.games_played += 1
            player_2_stats.games_played += 1
            
            if game.winner_id == game.player_1_id:
                player_1_stats.games_won += 1
                player_1_stats.current_win_streak += 1
                player_2_stats.games_lost += 1
                player_2_stats.current_win_streak = 0
            elif game.winner_id == game.player_2_id:
                player_2_stats.games_won += 1
                player_2_stats.current_win_streak += 1
                player_1_stats.games_lost += 1
                player_1_stats.current_win_streak = 0
                
            player_1_stats.save()
            player_2_stats.save()
        else:
             # AI game
            player_1_stats.games_played += 1
            if game.winner_id == game.player_1_id:
                 player_1_stats.games_won += 1
            else:
                 player_1_stats.games_lost += 1
            player_1_stats.save()

        # Cleanup active game mappings
        self.redis_manager.remove_active_game(str(player_1_id))
        if player_2_id:
            self.redis_manager.remove_active_game(str(player_2_id))


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for receiving notifications.
    
    Connection URL: ws://domain/ws/notifications/
    """
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = None
        self.redis_manager = GameStateManager()
    
    async def connect(self):
        """Handle WebSocket connection."""
        try:
            user = await self._get_user_from_token_notification()
            if not user:
                await self.close(code=4401)
                return
            
            self.user = user
            
            # Join user's notification group
            await self.channel_layer.group_add(
                f"notifications_{user.id}",
                self.channel_name
            )
            
            await self.accept()
            
            # Send initial connection message
            await self.send(json.dumps({
                'type': 'connected',
                'user_id': str(user.id),
            }))
        
        except Exception as e:
            await self.close(code=4000)
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if self.user:
            await self.channel_layer.group_discard(
                f"notifications_{self.user.id}",
                self.channel_name
            )
    
    async def receive(self, text_data):
        """Handle incoming messages."""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'mark_read':
                await self._handle_mark_read(data)
            elif message_type == 'ping':
                await self.send(json.dumps({'type': 'pong'}))
            else:
                # Ignore unknown message types; client is expected to send supported types only.
                pass
        
        except json.JSONDecodeError:
            # Ignore malformed JSON payloads; invalid messages are simply dropped.
            pass
        except Exception as e:
            # Swallow unexpected errors to avoid breaking the WebSocket connection.
            # Consider adding logging here if more visibility into failures is needed.
            pass
    
    async def _handle_mark_read(self, data):
        """Handle marking notification as read."""
        notification_id = data.get('notification_id')
        if notification_id:
            await self._mark_notification_read(notification_id)
    
    # Handler methods for group messages
    
    async def notification(self, event):
        """Send notification to WebSocket."""
        await self.send(json.dumps({
            'type': 'notification',
            'notification_type': event.get('notification_type'),
            'title': event.get('title'),
            'message': event.get('message'),
            'data': event.get('data', {}),
        }))
    
    async def friend_request(self, event):
        """Send friend request notification."""
        await self.send(json.dumps({
            'type': 'notification',
            'notification_type': 'friend_request',
            'title': 'Friend Request',
            'message': event.get('message'),
            'data': event.get('data', {}),
        }))
    
    async def game_invitation(self, event):
        """Send game invitation notification."""
        await self.send(json.dumps({
            'type': 'notification',
            'notification_type': 'game_invitation',
            'title': 'Game Invitation',
            'message': event.get('message'),
            'data': event.get('data', {}),
        }))
    
    @database_sync_to_async
    def _get_user_from_token_notification(self):
        """Extract user from JWT token (placeholder for future JWT implementation)."""
        # TODO: Implement JWT authentication with rest_framework_simplejwt
        # For now, return None - WebSocket auth will be handled via separate endpoint
        return None
    
    @database_sync_to_async
    def _mark_notification_read(self, notification_id):
        """Mark notification as read in database."""
        from social.models import Notification
        from django.utils import timezone
        try:
            notification = Notification.objects.get(
                id=notification_id,
                user=self.user
            )
            notification.is_read = True
            notification.read_at = timezone.now()
            notification.save(update_fields=['is_read', 'read_at'])
        except Notification.DoesNotExist:
            # Notification does not exist or no longer belongs to this user; safe to ignore.
            pass
