# Leaderboard and Rankings System

This document describes the **currently implemented** leaderboard behavior.

## Implemented Leaderboard Endpoint

- `GET /api/games/leaderboard/?limit=<n>`
- Implemented in `GameViewSet.leaderboard`
- Requires authenticated session (default DRF permissions)

### Query behavior

- default `limit = 100`
- invalid limit -> fallback to `100`
- max limit capped at `500`

### Ranking criteria

Backend query:

- includes only active users with at least 1 played game
- ordering: `games_won DESC`, then `accuracy_percentage DESC`

### Response shape

```json
[
  {
    "rank": 1,
    "user_id": "uuid",
    "username": "player",
    "games_played": 42,
    "games_won": 30,
    "win_rate": 71.43,
    "accuracy_percentage": 64.2
  }
]
```

## Frontend Usage (Implemented)

`frontend/src/pages/Leaderboard.js`:

- fetches once on mount: `GET /games/leaderboard/?limit=100`
- renders a single global table
- no friends tab, no filters, no pagination, no search

## Current Data Source

- source table: `PlayerStats`
- no Redis caching layer for leaderboard responses
- no background rank recomputation job

## Implemented vs Not Implemented

### Implemented

1. Global ranking list
2. Rank index in response (`1..N`)
3. Win rate and accuracy values returned

### Not Implemented Yet

1. Friends-only leaderboard endpoint
2. Time-period leaderboards (week/month)
3. Leaderboard search endpoint
4. Public unauthenticated leaderboard mode
5. WebSocket rank-change notifications
6. Redis cache invalidation strategy for leaderboard pages

## Error Handling (Current)

- Invalid `limit` value does not return an error; backend falls back to defaults.
- Standard auth failures can return `401` if session is missing/invalid.
