from django.utils import timezone
from channels.db import database_sync_to_async

@database_sync_to_async
def _finalize_game(self, winner_id):
    from game.models import Game, PlayerStats

    try:
        game = Game.objects.get(id=self.game_id)
    except Game.DoesNotExist:
        return

    if game.status in ['completed', 'forfeited']:
        return

    shots_p1 = self.redis_manager.get_shots(self.game_id, 'player_1')
    shots_p2 = self.redis_manager.get_shots(self.game_id, 'player_2')

    def summarize(shots):
        total = len(shots)
        hits = sum(1 for shot in shots if shot.get('result') == 'hit')
        return total, hits

    p1_shots, p1_hits = summarize(shots_p1)
    p2_shots, p2_hits = summarize(shots_p2)

    game.status = 'completed'
    game.winner_id = winner_id
    game.ended_at = timezone.now()
    if game.started_at:
        game.duration_seconds = int((game.ended_at - game.started_at).total_seconds())
    game.player_1_shots = p1_shots
    game.player_1_hits = p1_hits
    game.player_2_shots = p2_shots
    game.player_2_hits = p2_hits
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
