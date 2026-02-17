import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { Template, ReturnToMenuButton } from './Components';
import api from '../utils/api';

function DisplayNameEditor() {
  const { user, checkAuth } = useContext(AuthContext);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError('Display name cannot be empty');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await api.post('/auth/profile/update/', {
        display_name: displayName.trim()
      });
      await checkAuth();
      setIsEditing(false);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update display name';
      setError(errorMsg);
      console.error('Error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">Display Name</p>
          <p className="text-white font-semibold text-lg">{user?.display_name || 'N/A'}</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => {
              setDisplayName(user?.display_name || '');
              setIsEditing(true);
              setError('');
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-semibold text-white transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing && (
        <div className="mt-4">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter new display name"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400 mb-3"
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-500 rounded-md font-semibold text-white transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setError('');
              }}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-md font-semibold text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function PlayerStats() {
  const { user } = useContext(AuthContext);
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/games/stats/me/');
        setStats(response.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) {
      fetchStats();
    }
  }, [user?.id]);

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
        <p><span className="text-emerald-400 font-semibold">Email:</span> {user?.email || 'N/A'}</p>

        <hr className="border-slate-600 my-4" />
        <h3 className="text-lg font-semibold text-emerald-400 mt-6 mb-3">Game Statistics</h3>

        <div className="grid grid-cols-2 gap-4">
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

function Avatar() {
  const { user, checkAuth } = useContext(AuthContext);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [uploading, setUploading] = useState(false);

  // Helper to construct full media URL
  const getAvatarUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    if (path.startsWith('/media/')) return path;
    return `/media/${path}`;
  };

  const availableAvatars = [
    { id: 1, label: 'Avatar 1', path: 'avatars/avatar_1.jpg' },
    { id: 2, label: 'Avatar 2', path: 'avatars/avatar_2.jpg' },
    { id: 3, label: 'Avatar 3', path: 'avatars/avatar_3.jpg' },
    { id: 4, label: 'Avatar 4', path: 'avatars/avatar_4.jpg' },
  ];

  // Add custom avatar option if available
  if (user?.custom_avatar_url) {
    availableAvatars.push({
      id: 'custom',
      label: 'Custom Avatar',
      path: user.custom_avatar_url
    });
  }

  // Add Intra photo option if user has intra_avatar_url (now a local path)
  if (user?.intra_avatar_url) {
    availableAvatars.push({
      id: 'intra',
      label: '42 Intra Photo',
      path: user.intra_avatar_url
    });
  }

  const handleAvatarChange = async (avatarId) => {
    try {
      setAvatarError('');
      await api.post('/auth/avatar/set/', { avatar: avatarId });
      await checkAuth(); // Refresh user data
      setShowAvatarSelector(false);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update avatar';
      setAvatarError(errorMsg);
      console.error('Failed to update avatar:', err);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Client-side validation
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('File too large (max 2MB)');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select an image file');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setUploading(true);
    setAvatarError('');

    try {
      await api.post('/auth/avatar/upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      await checkAuth();
      setShowAvatarSelector(false);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to upload avatar';
      setAvatarError(errorMsg);
      console.error('Failed to upload avatar:', err);
    } finally {
      setUploading(false);
    }
  };

  // Construct source for current avatar
  const avatarSrc = getAvatarUrl(user?.avatar_url);

  return (
    <div className="flex flex-col">
      <div className="relative group">
        <img
          src={avatarSrc || '/media/avatars/avatar_1.jpg'} // Fallback
          alt="PlayerAvatar"
          className="w-full h-80 object-cover rounded-lg shadow-lg bg-slate-700"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/media/avatars/avatar_1.jpg';
          }}
        />
        <button
          onClick={() => setShowAvatarSelector(!showAvatarSelector)}
          className="absolute bottom-4 right-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-md font-semibold text-white transition-colors shadow-lg"
        >
          Change Avatar
        </button>
      </div>

      {showAvatarSelector && (
        <div className="mt-4 bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700 animate-fadeIn">
          <h3 className="text-white font-bold mb-3">Select Avatar</h3>

          {avatarError && <p className="text-red-400 text-sm mb-3">{avatarError}</p>}

          <div className="grid grid-cols-2 gap-3 mb-4">
            {availableAvatars.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => handleAvatarChange(avatar.id)}
                className={`p-2 rounded-lg transition-all border-2 ${user?.avatar_url === avatar.path
                  ? 'border-emerald-500 bg-emerald-500/10'
                  : 'border-slate-600 hover:border-emerald-400'
                  }`}
              >
                <img
                  src={getAvatarUrl(avatar.path)}
                  alt={avatar.label}
                  className="w-full h-20 object-cover rounded"
                />
                <p className="text-sm text-gray-300 mt-1 text-center truncate">{avatar.label}</p>
              </button>
            ))}
          </div>

          <div className="border-t border-slate-600 pt-4">
            <p className="text-gray-400 text-sm mb-2">Or upload your own:</p>
            <label className={`flex items-center justify-center w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-md cursor-pointer transition-colors border border-slate-600 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <span className="text-white font-medium">
                {uploading ? 'Uploading...' : '📁 Upload Custom Image'}
              </span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
            <p className="text-xs text-gray-500 mt-1 text-center">Max size: 2MB. JPG/PNG.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function GameHistory() {
  const { user } = useContext(AuthContext);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchGameHistory = async () => {
      try {
        setError('');
        const response = await api.get('/games/game_history/');
        setGames(response.data || []);
      } catch (err) {
        const errorMsg = err.response?.data?.error || 'Failed to fetch game history';
        setError(errorMsg);
        console.error('Failed to fetch game history:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchGameHistory();
    }
  }, [user?.id]);

  const formatDate = (dateString) => {
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
                    <td className="py-3 px-4">{game.opponent_username}</td>
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
  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto text-white">
      {/* Menu return button */}
      <ReturnToMenuButton />
      <DisplayNameEditor />
      <div className="grid grid-cols-2 gap-8 items-start">
        <PlayerStats />
        <Avatar />
      </div>
      <GameHistory />
    </div>
  );
}

function ProfilePage() {
  return (
    <Template>
      <Body />
    </Template>
  );
}

export default ProfilePage;
