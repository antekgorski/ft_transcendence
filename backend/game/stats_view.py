from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import PlayerStats


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def player_stats(request):
    """Get aggregated player stats for the current user.

    This endpoint is used by the frontend profile view. If the user
    does not have a PlayerStats record yet (no games played), we
    return zeros instead of 404 so the UI can show empty stats.
    """
    try:
        stats = PlayerStats.objects.get(user=request.user)
        games_played = stats.games_played
        win_rate = round((stats.games_won / games_played * 100), 1) if games_played > 0 else 0.0
        accuracy = round(stats.accuracy_percentage, 1) if stats.accuracy_percentage is not None else 0.0

        payload = {
            'gamesPlayed': games_played,
            'gamesWon': stats.games_won,
            'gamesLost': stats.games_lost,
            'winRate': win_rate,
            'totalShots': stats.total_shots,
            'totalHits': stats.total_hits,
            'accuracyPercentage': accuracy,
            'longestWinStreak': stats.longest_win_streak,
            'currentWinStreak': stats.current_win_streak,
            'bestGameDurationSeconds': stats.best_game_duration_seconds,
        }
    except PlayerStats.DoesNotExist:
        # User has no games yet – return zeroed stats instead of 404
        payload = {
            'gamesPlayed': 0,
            'gamesWon': 0,
            'gamesLost': 0,
            'winRate': 0.0,
            'totalShots': 0,
            'totalHits': 0,
            'accuracyPercentage': 0.0,
            'longestWinStreak': 0,
            'currentWinStreak': 0,
            'bestGameDurationSeconds': 0,
        }

    return Response(payload, status=status.HTTP_200_OK)
