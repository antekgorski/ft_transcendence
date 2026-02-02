from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import PlayerStats


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def player_stats(request):
    """
    Get player stats for the current user
    """
    try:
        stats = PlayerStats.objects.get(user=request.user)
        return Response({
            'gamesPlayed': stats.games_played,
            'gamesWon': stats.games_won,
            'gamesLost': stats.games_lost,
            'winRate': round((stats.games_won / stats.games_played * 100) if stats.games_played > 0 else 0, 1),
            'totalShots': stats.total_shots,
            'totalHits': stats.total_hits,
            'accuracyPercentage': round(stats.accuracy_percentage, 1),
            'longestWinStreak': stats.longest_win_streak,
            'currentWinStreak': stats.current_win_streak,
            'bestGameDurationSeconds': stats.best_game_duration_seconds,
        }, status=status.HTTP_200_OK)
    except PlayerStats.DoesNotExist:
        return Response({
            'error': 'Player stats not found',
            'error_pl': 'Statystyki gracza nie znalezione'
        }, status=status.HTTP_404_NOT_FOUND)
