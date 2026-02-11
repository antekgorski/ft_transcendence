import json
import redis
from django.conf import settings
from datetime import datetime, timedelta


class GameStateManager:
    """
    Manages game state in Redis.
    
    Redis Key Structure:
    - game:{game_id}:status - Current game status
    - game:{game_id}:player_1:ships - Player 1's placed ships
    - game:{game_id}:player_2:ships - Player 2's placed ships
    - game:{game_id}:player_1:board - Player 1's board state
    - game:{game_id}:player_2:board - Player 2's board state
    - game:{game_id}:player_1:shots - Player 1's shot history
    - game:{game_id}:player_2:shots - Player 2's shot history
    - game:{game_id}:current_turn - Current player's ID
    - game:{game_id}:grace_period_end - End time of 60-second grace period
    - user:{user_id}:online - User online status (with 5min TTL)
    - user:{user_id}:last_seen - User's last activity timestamp
    """
    
    def __init__(self):
        """Initialize Redis connection."""
        redis_url = settings.REDIS_URL
        if not redis_url:
            raise ValueError("REDIS_URL not configured")
        
        self.redis_client = redis.from_url(redis_url, decode_responses=True)
        self.game_expiration = 86400 * 7  # 7 days
        self.presence_expiration = 300  # 5 minutes
    
    def create_game(self, game_id, player_1_id, player_2_id, game_type, player_1_username=None, player_2_username=None):
        """Create a new game session in Redis."""
        game_key = f"game:{game_id}"
        
        normalized_player_2_id = player_2_id or ''

        game_data = {
            'game_id': str(game_id),
            'player_1_id': str(player_1_id),
            'player_2_id': str(normalized_player_2_id),
            'player_1_username': str(player_1_username or ''),
            'player_2_username': str(player_2_username or ''),
            'game_type': str(game_type),
            'status': 'pending',
            'created_at': datetime.utcnow().isoformat(),
        }
        
        # Store game metadata
        self.redis_client.hset(game_key, mapping=game_data)
        self.redis_client.expire(game_key, self.game_expiration)
        
        # Initialize player collections
        self.redis_client.delete(f"{game_key}:player_1:shots")
        self.redis_client.delete(f"{game_key}:player_2:shots")
    
    def delete_game(self, game_id):
        """Delete a game session from Redis."""
        game_key = f"game:{game_id}"
        # Delete all keys related to this game
        for key in self.redis_client.keys(f"{game_key}*"):
            self.redis_client.delete(key)
        
        # Also need to find and remove user active game mappings if we don't know the user IDs here
        # But usually we call remove_active_game explicitly

    def set_active_game(self, user_id, game_id):
        """Map user to their current game."""
        key = f"user:{user_id}:active_game"
        self.redis_client.set(key, game_id)
        self.redis_client.expire(key, self.game_expiration)

    def get_active_game(self, user_id):
        """Get current game ID for a user."""
        key = f"user:{user_id}:active_game"
        return self.redis_client.get(key)

    def remove_active_game(self, user_id):
        """Remove user's active game mapping."""
        key = f"user:{user_id}:active_game"
        self.redis_client.delete(key)

    def get_game_meta(self, game_id):
        """Get game metadata."""
        game_key = f"game:{game_id}"
        return self.redis_client.hgetall(game_key)
    
    def set_game_status(self, game_id, status):
        """Update game status."""
        game_key = f"game:{game_id}"
        self.redis_client.hset(game_key, "status", status)
    
    def get_game_status(self, game_id):
        """Get current game status."""
        game_key = f"game:{game_id}"
        return self.redis_client.hget(game_key, "status")
    
    def set_current_turn(self, game_id, player_id):
        """Set whose turn it is."""
        game_key = f"game:{game_id}"
        self.redis_client.hset(game_key, "current_turn", player_id)
    
    def get_current_turn(self, game_id):
        """Get whose turn it is."""
        game_key = f"game:{game_id}"
        return self.redis_client.hget(game_key, "current_turn")
    
    def set_ships(self, game_id, player_key, ships_data):
        """Store player's ship placement."""
        ships_key = f"game:{game_id}:{player_key}:ships"
        self.redis_client.set(ships_key, json.dumps(ships_data))
        self.redis_client.expire(ships_key, self.game_expiration)
    
    def get_ships(self, game_id, player_key):
        """Get player's placed ships."""
        ships_key = f"game:{game_id}:{player_key}:ships"
        data = self.redis_client.get(ships_key)
        return json.loads(data) if data else None
    
    def set_board_state(self, game_id, player_key, board_state):
        """Store player's board state."""
        board_key = f"game:{game_id}:{player_key}:board"
        self.redis_client.set(board_key, json.dumps(board_state))
        self.redis_client.expire(board_key, self.game_expiration)
    
    def get_board_state(self, game_id, player_key):
        """Get player's board state."""
        board_key = f"game:{game_id}:{player_key}:board"
        data = self.redis_client.get(board_key)
        return json.loads(data) if data else None
    
    def add_shot(self, game_id, player_key, shot_data):
        """Record a shot attempt."""
        shots_key = f"game:{game_id}:{player_key}:shots"
        self.redis_client.lpush(shots_key, json.dumps(shot_data))
        self.redis_client.expire(shots_key, self.game_expiration)
    
    def get_shots(self, game_id, player_key, limit=None):
        """Get shot history for a player."""
        shots_key = f"game:{game_id}:{player_key}:shots"
        count = limit or -1
        shots_data = self.redis_client.lrange(shots_key, 0, count)
        return [json.loads(shot) for shot in shots_data]
    
    def set_grace_period(self, game_id):
        """Set a 60-second grace period for reconnection."""
        grace_key = f"game:{game_id}:grace_period"
        grace_end = datetime.utcnow() + timedelta(seconds=60)
        self.redis_client.set(
            grace_key,
            grace_end.isoformat(),
            ex=60
        )
    
    def get_grace_period(self, game_id):
        """Check if grace period is active and get remaining time."""
        grace_key = f"game:{game_id}:grace_period"
        grace_end = self.redis_client.get(grace_key)
        if not grace_end:
            return None
        
        grace_time = datetime.fromisoformat(grace_end)
        remaining = (grace_time - datetime.utcnow()).total_seconds()
        return max(0, remaining)

    def set_player_disconnected(self, game_id, player_id):
        """Record player disconnection time."""
        key = f"game:{game_id}:disconnected:{player_id}"
        self.redis_client.set(key, datetime.utcnow().isoformat())
        self.redis_client.expire(key, self.game_expiration)

    def get_player_disconnected(self, game_id, player_id):
        """Get player disconnection time."""
        key = f"game:{game_id}:disconnected:{player_id}"
        timestamp = self.redis_client.get(key)
        return datetime.fromisoformat(timestamp) if timestamp else None

    def clear_player_disconnected(self, game_id, player_id):
        """Clear player disconnection record."""
        key = f"game:{game_id}:disconnected:{player_id}"
        self.redis_client.delete(key)
    
    def end_game(self, game_id):
        """Mark game as ended and prepare for cleanup."""
        game_key = f"game:{game_id}"
        self.redis_client.hset(game_key, "ended_at", datetime.utcnow().isoformat())
        # Reduce expiration for ended games (keep for 24 hours instead of 7 days)
        self.redis_client.expire(game_key, 86400)
    
    def set_user_online(self, user_id):
        """Mark user as online with 5-minute TTL."""
        online_key = f"user:{user_id}:online"
        self.redis_client.set(online_key, "1", ex=self.presence_expiration)
        
        # Update last seen
        last_seen_key = f"user:{user_id}:last_seen"
        self.redis_client.set(last_seen_key, datetime.utcnow().isoformat())
    
    def is_user_online(self, user_id):
        """Check if user is currently online."""
        online_key = f"user:{user_id}:online"
        return self.redis_client.exists(online_key) > 0
    
    def get_user_last_seen(self, user_id):
        """Get user's last activity time."""
        last_seen_key = f"user:{user_id}:last_seen"
        last_seen = self.redis_client.get(last_seen_key)
        return datetime.fromisoformat(last_seen) if last_seen else None
    
    def set_user_offline(self, user_id):
        """Mark user as offline."""
        online_key = f"user:{user_id}:online"
        self.redis_client.delete(online_key)
    
    def get_online_friends(self, user_id, friend_ids):
        """Get which friends are currently online."""
        online_friends = []
        for friend_id in friend_ids:
            if self.is_user_online(friend_id):
                online_friends.append(friend_id)
        return online_friends
    
    def store_notification(self, user_id, notification_data):
        """Store real-time notification in Redis queue."""
        notifications_key = f"notifications:{user_id}"
        self.redis_client.lpush(
            notifications_key,
            json.dumps(notification_data)
        )
        # Keep last 100 notifications per user
        self.redis_client.ltrim(notifications_key, 0, 99)
    
    def get_pending_notifications(self, user_id):
        """Get pending notifications for a user."""
        notifications_key = f"notifications:{user_id}"
        data = self.redis_client.lrange(notifications_key, 0, -1)
        return [json.loads(notif) for notif in data]
    
    def clear_notifications(self, user_id):
        """Clear notifications for a user."""
        notifications_key = f"notifications:{user_id}"
        self.redis_client.delete(notifications_key)
    
    def add_inactive_cells(self, game_id, player_key, inactive_cells):
        """Store inactive cells (boundaries around sunk ships)."""
        inactive_key = f"game:{game_id}:{player_key}:inactive"
        # Add all inactive cells to a set (union)
        for cell in inactive_cells:
            self.redis_client.sadd(inactive_key, json.dumps(cell))
        self.redis_client.expire(inactive_key, self.game_expiration)
    
    def get_inactive_cells(self, game_id, player_key):
        """Get all inactive cells for a player."""
        inactive_key = f"game:{game_id}:{player_key}:inactive"
        data = self.redis_client.smembers(inactive_key)
        return [json.loads(cell) for cell in data] if data else []
