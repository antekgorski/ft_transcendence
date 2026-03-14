# Game History & Match Details Process

This document describes the **currently implemented** history/stat endpoints.

## Implemented Endpoints

### Current user recent history

- `GET /api/games/game_history/`
- Returns last 10 games for authenticated user
- Includes only `status in ['completed', 'forfeited']`

### Public profile history view (authenticated)

- `GET /api/games/history/{user_id}/`
- Returns last 10 completed/forfeited games for the specified user
- Used by `UserProfilePage`

### Stats endpoints used with history views

- `GET /api/games/stats/me/`
- `GET /api/games/stats/{user_id}/`

## Current Response Model (History)

Each history entry includes:

- `id`
- `opponent_id`
- `opponent_username`
- `opponent_avatar_url`
- `game_type`, `game_type_display`
- `result` (`win`/`loss` relative to requested user context)
- `duration_seconds`
- `ended_at`
- shot/hit counters (`player_1_*`, `player_2_*`)

## Frontend Behavior (Implemented)

- Profile page (`/profile`) calls `GET /games/game_history/`
- Public user profile page (`/profile/:userId`) calls `GET /games/history/{userId}/`
- Both UIs display simple tabular summaries
- No server-side pagination/filter/search in current implementation

## Not Implemented (Compared to Earlier Design)

1. No `GET /api/games/{game_id}/details`
2. No head-to-head endpoint
3. No CSV export endpoint
4. No paginated history endpoint with `page/limit`
5. No history filtering by `result`, `opponent`, `game_type`, or date range
6. No dedicated aggregate statistics dashboard endpoint beyond existing `stats/me` and `stats/{user_id}`

## Error Handling (Current)

| Endpoint | Condition | Status |
|----------|-----------|--------|
| `/games/game_history/` | unauthenticated | 401 |
| `/games/history/{user_id}/` | unauthenticated | 401 |
| `/games/stats/me/` | stats missing | 404 |
| `/games/stats/{user_id}/` | stats missing | 200 with zeroed defaults |
