import json
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
# JWT authentication will be implemented in future - for now use custom auth
# from rest_framework_simplejwt.tokens import AccessToken
from .redis_manager import GameStateManager


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
    
    async def connect(self):
        """Handle WebSocket connection."""
        # Extract JWT from cookie
        try:
            user = await self._get_user_from_token()
            if not user:
                await self.close(code=4401)
                return
            
            self.user = user
            
            # Mark user as online
            await self._mark_user_online()
            
            # Accept connection
            await self.accept()
            
            # Send connection confirmation
            await self.send(json.dumps({
                'type': 'connected',
                'user_id': str(user.id),
                'username': user.username,
            }))
            
        except Exception as e:
            await self.close(code=4000)
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        if self.user:
            # Mark user as offline
            await self._mark_user_offline()
            
            # If user was in a game, set grace period
            if self.game_id:
                await self._set_grace_period()
        
        if self.game_id:
            # Leave game group
            await self.channel_layer.group_discard(
                f"game_{self.game_id}",
                self.channel_name
            )
    
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
        
        # Verify user is in game
        is_valid = await self._verify_user_in_game(game_id)
        if not is_valid:
            await self.send_error('User not in this game')
            return
        
        self.game_id = game_id
        
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
        
        move_data = {
            'type': 'game_move',
            'player_id': str(self.user.id),
            'move_type': data.get('move_type'),
            'data': data.get('data', {}),
        }
        
        # Track move in Redis for later retrieval
        await self._record_move(move_data)
        
        # Broadcast to game group
        await self.channel_layer.group_send(
            f"game_{self.game_id}",
            move_data
        )
    
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
    
    @database_sync_to_async
    def _get_user_from_token(self):
        """Extract user from JWT token in cookie (placeholder for future JWT implementation)."""
        # TODO: Implement JWT authentication with rest_framework_simplejwt
        # For now, return None - WebSocket auth will be handled via separate endpoint
        # token_str = self.scope.get('cookies', {}).get('access_token')
        # token = AccessToken(token_str)
        # user_id = token.get('user_id')
        # from authentication.models import User
        # user = User.objects.get(id=user_id, is_active=True)
        # return user
        return None
    
    @database_sync_to_async
    def _verify_user_in_game(self, game_id):
        """Verify user is actually in the game."""
        from game.models import Game
        try:
            game = Game.objects.get(id=game_id)
            is_player = game.player_1_id == self.user.id or game.player_2_id == self.user.id
            return is_player
        except Game.DoesNotExist:
            return False
    
    async def _mark_user_online(self):
        """Mark user as online in Redis."""
        if self.user:
            self.redis_manager.set_user_online(str(self.user.id))
    
    async def _mark_user_offline(self):
        """Mark user as offline in Redis."""
        if self.user:
            self.redis_manager.set_user_offline(str(self.user.id))
    
    async def _set_grace_period(self):
        """Set 60-second grace period for reconnection."""
        self.redis_manager.set_grace_period(self.game_id)


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
            user = await self._get_user_from_token()
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
                pass
        
        except json.JSONDecodeError:
            pass
        except Exception as e:
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
