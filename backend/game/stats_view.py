from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.db.models import Q
from .models import PlayerStats, Game


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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_stats(request, user_id):
    """
    Get player stats for a specific user by ID.
    """
    try:
        stats = PlayerStats.objects.get(user_id=user_id)
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
            'gamesPlayed': 0,
            'gamesWon': 0,
            'gamesLost': 0,
            'winRate': 0,
            'totalShots': 0,
            'totalHits': 0,
            'accuracyPercentage': 0,
            'longestWinStreak': 0,
            'currentWinStreak': 0,
            'bestGameDurationSeconds': 0,
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_game_history(request, user_id):
    """
    Get the last 10 completed or forfeited games for a specific user.
    """
    games = Game.objects.filter(
        Q(player_1_id=user_id) | Q(player_2_id=user_id),
        status__in=['completed', 'forfeited']
    ).select_related('player_1', 'player_2', 'winner').order_by('-ended_at')[:10]

    history = []
    for game in games:
        # Determine opponent and result relative to the target user
        if str(game.player_1_id) == str(user_id):
            opponent = game.player_2
            player_shots = game.player_1_shots
            player_hits = game.player_1_hits
        else:
            opponent = game.player_1
            player_shots = game.player_2_shots
            player_hits = game.player_2_hits

        opponent_username = opponent.username if opponent else 'Unknown'
        result = 'win' if game.winner_id and str(game.winner_id) == str(user_id) else 'loss'
        game_type_map = {'pvp': 'PvP', 'ai': 'AI'}

        history.append({
            'id': str(game.id),
            'opponent_id': str(opponent.id) if opponent else None,
            'opponent_username': opponent_username,
            'game_type': game.game_type,
            'game_type_display': game_type_map.get(game.game_type, game.game_type),
            'result': result,
            'duration_seconds': game.duration_seconds,
            'ended_at': game.ended_at.isoformat() if game.ended_at else None,
            'player_1_shots': player_shots,
            'player_1_hits': player_hits,
        })

    return Response(history, status=status.HTTP_200_OK)

