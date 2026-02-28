import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Template, ReturnToMenuButton } from './Components';
import api from '../utils/api';

function UserAvatar({ user }) {
    const getAvatarUrl = (path) => {
        if (!path) return '/media/avatars/avatar_1.jpg';
        if (path.startsWith('http')) return path;
        if (path.startsWith('/media/')) return path;
        return `/media/${path}`;
    };

    return (
        <div className="flex flex-col">
            <img
                src={getAvatarUrl(user?.avatar_url)}
                alt={user?.username || 'User Avatar'}
                className="w-full h-80 object-cover rounded-lg shadow-lg bg-slate-700"
                onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/media/avatars/avatar_1.jpg';
                }}
            />
        </div>
    );
}

function UserStats({ stats, loading, user }) {
    const formatDuration = (seconds) => {
        if (!seconds) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-4">Player Profile</h2>
            <div className="text-gray-300 space-y-3">
                <p><span className="text-emerald-400 font-semibold">Username:</span> {user?.username || 'Loading...'}</p>
                <p className="flex items-center gap-2">
                    <span className="text-emerald-400 font-semibold">Status:</span>
                    {user?.is_online ? (
                        <span className="flex items-center gap-1.5">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                            <span className="text-emerald-400 font-medium">Online</span>
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5">
                            <span className="inline-flex rounded-full h-3 w-3 bg-gray-500"></span>
                            <span className="text-gray-400 font-medium">Offline</span>
                        </span>
                    )}
                </p>
                <p><span className="text-emerald-400 font-semibold">Display Name:</span> {user?.display_name || 'N/A'}</p>

                <hr className="border-slate-600 my-4" />
                <h3 className="text-lg font-semibold text-emerald-400 mt-6 mb-3">Game Statistics</h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <p><span className="text-emerald-400 font-semibold">Games Played:</span> {loading ? 'Loading...' : (stats.gamesPlayed ?? '0')}</p>
                        <p><span className="text-emerald-400 font-semibold">Games Won:</span> {loading ? 'Loading...' : (stats.gamesWon ?? '0')}</p>
                        <p><span className="text-emerald-400 font-semibold">Games Lost:</span> {loading ? 'Loading...' : (stats.gamesLost ?? '0')}</p>
                        <p><span className="text-emerald-400 font-semibold">Win Rate:</span> {loading ? 'Loading...' : (stats.winRate !== null ? `${stats.winRate}%` : 'N/A')}</p>
                    </div>
                    <div>
                        <p><span className="text-emerald-400 font-semibold">Total Shots:</span> {loading ? 'Loading...' : (stats.totalShots ?? '0')}</p>
                        <p><span className="text-emerald-400 font-semibold">Total Hits:</span> {loading ? 'Loading...' : (stats.totalHits ?? '0')}</p>
                        <p><span className="text-emerald-400 font-semibold">Accuracy:</span> {loading ? 'Loading...' : (stats.accuracyPercentage !== null ? `${stats.accuracyPercentage}%` : 'N/A')}</p>
                        {stats.bestGameDurationSeconds > 0 && (
                            <p><span className="text-emerald-400 font-semibold">Quickest Win:</span> {loading ? 'Loading...' : formatDuration(stats.bestGameDurationSeconds)}</p>
                        )}
                    </div>
                </div>

                <hr className="border-slate-600 my-4" />
                <h3 className="text-lg font-semibold text-emerald-400 mt-6 mb-3">Streaks</h3>
                <p><span className="text-emerald-400 font-semibold">Current Win Streak:</span> {loading ? 'Loading...' : (stats.currentWinStreak ?? '0')}</p>
                <p><span className="text-emerald-400 font-semibold">Longest Win Streak:</span> {loading ? 'Loading...' : (stats.longestWinStreak ?? '0')}</p>
            </div>
        </div>
    );
}

function UserGameHistory({ userId }) {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchGameHistory = async () => {
            try {
                setError('');
                const response = await api.get(`/games/history/${userId}/`);
                setGames(response.data || []);
            } catch (err) {
                const errorMsg = err.response?.data?.error || 'Failed to fetch game history';
                setError(errorMsg);
                console.error('Failed to fetch game history:', err);
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            fetchGameHistory();
        }
    }, [userId]);

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDuration = (seconds) => {
        if (!seconds) return 'N/A';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    };

    return (
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
            <h2 className="text-2xl font-bold text-white mb-4">Game History</h2>

            {error && (
                <p className="text-red-400 mb-4">{error}</p>
            )}

            {loading ? (
                <p className="text-gray-400">Loading game history...</p>
            ) : games.length === 0 ? (
                <p className="text-gray-400">No games played yet</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-gray-300">
                        <thead>
                            <tr className="border-b border-slate-600">
                                <th className="text-left py-3 px-4 font-semibold text-emerald-400">Date</th>
                                <th className="text-left py-3 px-4 font-semibold text-emerald-400">Opponent</th>
                                <th className="text-left py-3 px-4 font-semibold text-emerald-400">Type</th>
                                <th className="text-left py-3 px-4 font-semibold text-emerald-400">Result</th>
                                <th className="text-left py-3 px-4 font-semibold text-emerald-400">Duration</th>
                                <th className="text-left py-3 px-4 font-semibold text-emerald-400">Accuracy</th>
                            </tr>
                        </thead>
                        <tbody>
                            {games.map((game, index) => {
                                const accuracy = game.player_1_shots > 0
                                    ? Math.round((game.player_1_hits / game.player_1_shots) * 100)
                                    : 0;
                                const resultColor = game.result === 'win' ? 'text-emerald-400' : 'text-red-400';
                                const resultText = game.result === 'win' ? 'Win' : 'Loss';

                                return (
                                    <tr key={index} className="border-b border-slate-700 hover:bg-slate-700/30 transition-colors">
                                        <td className="py-3 px-4">{formatDate(game.ended_at)}</td>
                                        <td className="py-3 px-4">
                                            {game.game_type !== 'ai' ? (
                                                <Link to={`/profile/${game.opponent_id || userId}`} className="text-blue-400 hover:text-blue-300 hover:underline transition-colors">
                                                    {game.opponent_username}
                                                </Link>
                                            ) : (
                                                game.opponent_username
                                            )}
                                        </td>
                                        <td className="py-3 px-4">{game.game_type_display}</td>
                                        <td className={`py-3 px-4 font-semibold ${resultColor}`}>{resultText}</td>
                                        <td className="py-3 px-4">{formatDuration(game.duration_seconds)}</td>
                                        <td className="py-3 px-4">{accuracy}%</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function Body() {
    const { userId } = useParams();
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState({
        gamesPlayed: null,
        gamesWon: null,
        gamesLost: null,
        winRate: null,
        totalShots: null,
        totalHits: null,
        accuracyPercentage: null,
        longestWinStreak: null,
        currentWinStreak: null,
        bestGameDurationSeconds: null,
    });
    const [profileLoading, setProfileLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await api.get(`/auth/users/${userId}/`);
                setUser(response.data);
            } catch (err) {
                setError('User not found.');
                console.error('Failed to fetch user profile:', err);
            } finally {
                setProfileLoading(false);
            }
        };

        const fetchStats = async () => {
            try {
                const response = await api.get(`/games/stats/${userId}/`);
                setStats(response.data);
            } catch (err) {
                console.error('Failed to fetch stats:', err);
            } finally {
                setStatsLoading(false);
            }
        };

        if (userId) {
            fetchProfile();
            fetchStats();
        }
    }, [userId]);

    if (profileLoading) {
        return (
            <div className="space-y-6 w-full max-w-6xl mx-auto text-white">
                <ReturnToMenuButton />
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
                    <p className="text-gray-400">Loading profile...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6 w-full max-w-6xl mx-auto text-white">
                <ReturnToMenuButton />
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
                    <p className="text-red-400 text-lg">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full max-w-6xl mx-auto text-white">
            <ReturnToMenuButton />
            <div className="grid grid-cols-1 gap-8 items-start lg:grid-cols-2">
                <UserStats stats={stats} loading={statsLoading} user={user} />
                <UserAvatar user={user} />
            </div>
            <UserGameHistory userId={userId} />
        </div>
    );
}

function UserProfilePage() {
    return (
        <Template>
            <Body />
        </Template>
    );
}

export default UserProfilePage;
