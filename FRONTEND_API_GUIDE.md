# Frontend API Integration Guide

## Overview

The backend uses both **REST APIs** for data operations and **WebSocket** for real-time game events:
- **REST APIs**: Authentication, game setup, friendships, and notifications
- **WebSocket**: Real-time game moves and events during active games

## Quick Setup

```javascript
const API_BASE = 'http://localhost:8080/api';
const WS_GAMES = 'ws://localhost:8080/ws/games/';

// Always include credentials for authenticated requests
const fetchOptions = {
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' }
};
```

---

## REST API Endpoints

### Authentication

| Goal | Method | Endpoint | Body |
|------|--------|----------|------|
| Register user | POST | `/auth/register/` | `{username, email, password}` |
| Login user | POST | `/auth/login/` | `{username, password}` |
| Get current user | GET | `/auth/profile/` | — |

**Example:**
```javascript
// Register
fetch(`${API_BASE}/auth/register/`, {
  method: 'POST',
  ...fetchOptions,
  body: JSON.stringify({username: 'player1', email: 'p1@example.com', password: 'Pass123!'})
});

// Login
fetch(`${API_BASE}/auth/login/`, {
  method: 'POST',
  ...fetchOptions,
  body: JSON.stringify({username: 'player1', password: 'Pass123!'})
});

// Get profile
fetch(`${API_BASE}/auth/profile/`, {credentials: 'include'});
```

---

### Games

| Goal | Method | Endpoint | Body |
|------|--------|----------|------|
| Create PvP game | POST | `/games/` | `{game_type: 'pvp', opponent_id}` |
| Create AI game | POST | `/games/` | `{game_type: 'ai'}` |
| Accept game | POST | `/games/{id}/accept/` | — |
| Decline game | POST | `/games/{id}/decline/` | — |
| Place ships | POST | `/games/{id}/ships/` | `{ship_type, positions}` |
| Check ships status | GET | `/games/{id}/ships/status/` | — |
| Forfeit game | POST | `/games/{id}/forfeit/` | — |
| End game (save results) | POST | `/games/{id}/end-game/` | `{winner_id, player_1_shots, player_1_hits, player_2_shots, player_2_hits}` |
| Get leaderboard | GET | `/games/leaderboard/?limit=10` | — |
| Get active games | GET | `/games/active/` | — |

**Examples:**

```javascript
// Create PvP game
fetch(`${API_BASE}/games/`, {
  method: 'POST',
  ...fetchOptions,
  body: JSON.stringify({game_type: 'pvp', opponent_id: 'friend-uuid'})
});

// Create AI game
fetch(`${API_BASE}/games/`, {
  method: 'POST',
  ...fetchOptions,
  body: JSON.stringify({game_type: 'ai'})
});

// Accept game invitation
fetch(`${API_BASE}/games/game-uuid/accept/`, {
  method: 'POST',
  ...fetchOptions
});

// Place battleship
fetch(`${API_BASE}/games/game-uuid/ships/`, {
  method: 'POST',
  ...fetchOptions,
  body: JSON.stringify({
    ship_type: 'battleship',
    positions: [{x: 0, y: 0}, {x: 1, y: 0}, {x: 2, y: 0}, {x: 3, y: 0}]
  })
});

// Check if both players ready
fetch(`${API_BASE}/games/game-uuid/ships/status/`, {credentials: 'include'});

// End game when all opponent ships are sunk (save results)
fetch(`${API_BASE}/games/game-uuid/end-game/`, {
  method: 'POST',
  ...fetchOptions,
  body: JSON.stringify({
    winner_id: 'player-1-uuid',
    player_1_shots: 42,
    player_1_hits: 17,
    player_2_shots: 38,
    player_2_hits: 20
  })
});

// Get leaderboard
fetch(`${API_BASE}/games/leaderboard/?limit=10`, {credentials: 'include'});
```

**Leaderboard Response:**
```json
[
  {
    "rank": 1,
    "user_id": "uuid-string",
    "username": "player_name",
    "games_played": 42,
    "games_won": 28,
    "win_rate": 66.67,
    "accuracy_percentage": 45.3
  }
]
```

**PlayerStats Auto-Update:**
After each game ends (via `/end-game/` or `/forfeit/`), the backend automatically updates the player's statistics:
- `games_played` — Total games completed
- `games_won` — Total victories
- `games_lost` — Total defeats
- `total_shots` — Cumulative shots across all games
- `total_hits` — Cumulative hits across all games
- `accuracy_percentage` — Calculated as (total_hits / total_shots) × 100
- `current_win_streak` — Consecutive wins (resets on loss)
- `longest_win_streak` — Best streak ever achieved
- `best_game_duration_seconds` — Longest game duration played

No additional API call needed—stats update automatically when game ends!

### Friendships

| Goal | Method | Endpoint | Body |
|------|--------|----------|------|
| Send request | POST | `/social/friendships/` | `{user_id}` |
| Get pending | GET | `/social/friendships/pending/` | — |
| Get accepted | GET | `/social/friendships/accepted/` | — |
| Accept request | POST | `/social/friendships/{id}/accept/` | — |
| Reject request | POST | `/social/friendships/{id}/reject/` | — |
| Block user | POST | `/social/friendships/{id}/block/` | — |
| Remove friend | DELETE | `/social/friendships/{id}/` | — |

**Examples:**

```javascript
// Send friend request
fetch(`${API_BASE}/social/friendships/`, {
  method: 'POST',
  ...fetchOptions,
  body: JSON.stringify({user_id: 'target-uuid'})
});

// Get friend requests
fetch(`${API_BASE}/social/friendships/pending/`, {credentials: 'include'});

// Accept friend request
fetch(`${API_BASE}/social/friendships/friendship-uuid/accept/`, {
  method: 'POST',
  ...fetchOptions
});

// Get friends
fetch(`${API_BASE}/social/friendships/accepted/`, {credentials: 'include'});
```

---

### Notifications

| Goal | Method | Endpoint | Body |
|------|--------|----------|------|
| Get notifications | GET | `/social/notifications/` | — |
| Get unread count | GET | `/social/notifications/unread/` | — |
| Mark as read | PATCH | `/social/notifications/{id}/` | `{is_read: true}` |
| Mark all as read | POST | `/social/notifications/mark-all-read/` | — |
| Delete | DELETE | `/social/notifications/{id}/` | — |

Notifications are fetched via REST API. Check for new notifications periodically (recommended: every 5-10 seconds) or after user actions.

**Examples:**

```javascript
// Get all notifications
fetch(`${API_BASE}/social/notifications/`, {credentials: 'include'});

// Get unread count
fetch(`${API_BASE}/social/notifications/unread/`, {credentials: 'include'});

// Mark as read
fetch(`${API_BASE}/social/notifications/notif-uuid/`, {
  method: 'PATCH',
  ...fetchOptions,
  body: JSON.stringify({is_read: true})
});

// Mark all as read
fetch(`${API_BASE}/social/notifications/mark-all-read/`, {
  method: 'POST',
  ...fetchOptions
});
```

---

## WebSocket Events

### Games WebSocket
**URL:** `ws://localhost:8080/ws/games/`

**Connect and Join Game:**
```javascript
const gameWs = new WebSocket('ws://localhost:8080/ws/games/');

gameWs.onopen = () => {
  // Join a game
  gameWs.send(JSON.stringify({
    type: 'join',
    game_id: 'game-uuid'
  }));
};

gameWs.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // Handle incoming messages
};
```

**Send Events:**

| Goal | Event Type | Payload |
|------|-----------|---------|
| Keep alive | ping | `{type: 'ping', timestamp}` |
| Make move | game_move | `{type: 'game_move', move_type, data}` |
| Forfeit | game_forfeit | `{type: 'game_forfeit'}` |

**Examples:**

```javascript
// Ping/heartbeat (every 30 seconds)
gameWs.send(JSON.stringify({
  type: 'ping',
  timestamp: Date.now()
}));

// Fire shot at opponent
gameWs.send(JSON.stringify({
  type: 'game_move',
  move_type: 'fire_shot',
  data: {x: 5, y: 5}
}));

// Forfeit game
gameWs.send(JSON.stringify({
  type: 'game_forfeit'
}));
```

**Receive Events:**

| Event | Meaning | Payload |
|-------|---------|---------|
| connected | WebSocket connected | `{type: 'connected', user_id, username}` |
| player_joined | Player joined game | `{type: 'player_joined', player_id, username}` |
| game_move | Opponent made move | `{type: 'game_move', player_id, move_type, data}` |
| game_forfeit | Opponent forfeited | `{type: 'game_forfeit', player_id}` |
| game_ended | Game finished | `{type: 'game_ended', winner_id, reason}` |
| error | Error occurred | `{type: 'error', message}` |

**Example Handler:**

```javascript
gameWs.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  switch(msg.type) {
    case 'connected':
      console.log('Connected:', msg.username);
      break;
    case 'game_move':
      console.log('Opponent shot at:', msg.data);
      break;
    case 'game_ended':
      console.log('Winner:', msg.winner_id);
      break;
    case 'error':
      console.error('Error:', msg.message);
      break;
  }
};
```

---

### Notifications Polling Pattern

Implement polling to check for new notifications. This pattern works well for checking every 5-10 seconds or after user actions:

```javascript
async function checkNotifications() {
  const response = await fetch(`${API_BASE}/social/notifications/`, {
    credentials: 'include'
  });
  const notifications = await response.json();
  
  notifications.forEach(notif => {
    if (!notif.is_read) {
      // Display notification to user
      displayNotification(notif.title, notif.message);
      // Mark as read
      markAsRead(notif.id);
    }
  });
}

// Poll every 10 seconds
setInterval(checkNotifications, 10000);
```

**Notification types:**
- `friend_request`: You received a friend request
- `friend_accepted`: Your friend request was accepted
- `game_invitation`: You received a game challenge

---

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (not logged in) |
| 403 | Forbidden (permission denied) |
| 404 | Not Found |
| 409 | Conflict (user busy, already in game, etc.) |

---

## Game Flow

1. **Setup Phase** → Use REST API
   - Register/Login
   - Create game or accept invitation
   - Place ships via `/ships/` endpoint
   - Poll `/ships/status/` until both ready

2. **Gameplay Phase** → Use WebSocket
   - Connect to `ws://localhost:8080/ws/games/`
   - Send/receive game_move events
   - Listen for game_ended event
   - When all opponent ships sunk: Call `POST /games/{id}/end-game/` with final stats

3. **After Game** → Use REST API
   - Check leaderboard
   - View game history

---

## Common Patterns

**Check if both players ready:**
```javascript
const status = await fetch(`${API_BASE}/games/game-uuid/ships/status/`, {credentials: 'include'});
const json = await status.json();
if (json.both_ready) {
  // Connect to WebSocket
}
```

**Handle WebSocket reconnection:**
```javascript
let reconnectAttempts = 0;
const maxRetries = 5;

function connectGameWs() {
  const ws = new WebSocket(WS_GAMES);
  ws.onopen = () => {
    reconnectAttempts = 0;
    ws.send(JSON.stringify({type: 'join', game_id: gameId}));
  };
  ws.onclose = () => {
    if (reconnectAttempts < maxRetries) {
      reconnectAttempts++;
      setTimeout(connectGameWs, 2000 * reconnectAttempts);
    }
  };
  return ws;
}
```

**End game when all opponent ships are sunk:**
```javascript
// When you detect opponent has 0 ships remaining
async function endGame(gameId, winnerId, player1Stats, player2Stats) {
  const response = await fetch(`${API_BASE}/games/${gameId}/end-game/`, {
    method: 'POST',
    ...fetchOptions,
    body: JSON.stringify({
      winner_id: winnerId,
      player_1_shots: player1Stats.totalShots,
      player_1_hits: player1Stats.totalHits,
      player_2_shots: player2Stats.totalShots,
      player_2_hits: player2Stats.totalHits
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to save game results');
  }
  
  return response.json();
}
```

**Display errors:**
```javascript
fetch(url, options)
  .then(r => {
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  })
  .catch(err => {
    console.error('Error:', err);
    // Show error to user
  });
```

