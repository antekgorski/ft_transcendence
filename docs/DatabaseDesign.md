# Database Design - 3D Tactical Battleship

## Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ PlayerStats : "has"
    User ||--o{ Game : "player_1"
    User ||--o{ Game : "player_2"
    User ||--o{ Game : "winner"
    User ||--o{ Friendship : "initiates"
    User ||--o{ Friendship : "receives"
    User ||--o{ Notification : "receives"
    
    User {
        uuid id PK
        string username UK
        string email UK
        string password_hash
        string display_name
        string avatar_url
        string language
        string oauth_provider
        string oauth_id
        boolean is_active
        json notification_preferences
        timestamp created_at
        timestamp last_login
    }
    
    Notification {
        uuid id PK
        uuid user_id FK
        string type
        string title
        text message
        json data
        boolean is_read
        timestamp read_at
        timestamp created_at
        timestamp expires_at
        string action_url
    }
    
    PlayerStats {
        uuid id PK
        uuid user_id FK
        int games_played
        int games_won
        int games_lost
        int total_shots
        int total_hits
        float accuracy_percentage
        int longest_win_streak
        int current_win_streak
        int best_game_duration_seconds
        timestamp updated_at
    }
    
    Game {
        uuid id PK
        uuid player_1_id FK
        uuid player_2_id FK "null for AI opponent"
        string game_type "pvp|ai"
        string status "pending|active|completed|forfeited"
        uuid winner_id FK
        int duration_seconds
        int player_1_shots
        int player_1_hits
        int player_2_shots
        int player_2_hits
        timestamp started_at
        timestamp ended_at
    }
    
    Friendship {
        uuid id PK
        uuid requester_id FK
        uuid addressee_id FK
        string status "pending|accepted|blocked"
        timestamp created_at
        timestamp updated_at
    }
```

## Schema Description

### Persistent Entities

#### User
Stores all user account information including OAuth integration (42 Intra), language preferences, and authentication details.

#### PlayerStats
Tracks comprehensive statistics for each player including win/loss ratios, accuracy, and streaks. Updated after each completed game.

#### Game
Historical record of completed games with summary statistics. Stores final results and performance metrics for both players. Includes status tracking for game lifecycle:
- `pending`: Game created, waiting for opponent acceptance
- `active`: Game in progress, players taking turns
- `completed`: Game finished normally with a winner
- `forfeited`: Game ended due to forfeit or player timeout during disconnection

Games are always real-time. If a player disconnects, they have 60 seconds to reconnect before automatically forfeiting.

#### Friendship
Manages friend connections with pending/accepted/blocked states.

#### Notification
Stores in-app notifications for users. Includes friend requests, game invitations, system announcements, etc. Old notifications automatically expire after 30 days.

### Real-Time Data (Not Stored in Database)

The following data exists only in **Redis** and **WebSocket sessions** during active gameplay:

- **Game State**: Board configurations, ship placements, current turn
- **Moves**: Real-time shot coordinates and results
- **Chat Messages**: In-game communication
- **Ship Positions**: Live ship placement and hit tracking

When a game ends, only the summary statistics are persisted to the `Game` table and player stats are updated.

## Key Design Decisions

1. **Minimal Persistent Data**: Only stores user profiles, stats, and game history
2. **Real-Time with Redis**: Active game state managed in-memory for performance
3. **UUID Primary Keys**: Better for distributed systems and microservices architecture
4. **Summary Statistics**: Games table captures essential metrics without move-by-move data
5. **Soft Deletes**: `is_active` flag for user account management
6. **OAuth Flexibility**: `oauth_provider` and `oauth_id` support multiple authentication providers
