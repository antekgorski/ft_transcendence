import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config';
import { AuthContext } from '../contexts/AuthContext';
import { Template } from './Components';
import api from '../utils/api';
import axios from 'axios';

const MEDIA_BASE_URL = process.env.REACT_APP_MEDIA_URL || API_BASE_URL.replace(/\/api\/?$/, '');

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
  
  const availableAvatars = [
    { id: 1, label: 'Avatar 1', path: 'avatars/avatar_1.jpg' },
    { id: 2, label: 'Avatar 2', path: 'avatars/avatar_2.jpg' },
    { id: 3, label: 'Avatar 3', path: 'avatars/avatar_3.jpg' },
    { id: 4, label: 'Avatar 4', path: 'avatars/avatar_4.jpg' },
  ];

  // Add Intra photo option if user has original_avatar_url
  if (user?.original_avatar_url) {
    availableAvatars.push({
      id: 'intra',
      label: '42 Intra Photo',
      path: user.original_avatar_url
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

  const avatarSrc = user?.avatar_url?.startsWith('http') ? user.avatar_url : `${MEDIA_BASE_URL}/media/${user?.avatar_url}`;

  return (
    <div className="flex flex-col">
      <div className="relative">
        <img 
          src={avatarSrc}
          alt="PlayerAvatar" 
          className="w-full h-80 object-cover rounded-lg shadow-lg"
        />
        <button
          onClick={() => setShowAvatarSelector(!showAvatarSelector)}
          className="absolute bottom-4 right-4 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-md font-semibold text-white transition-colors"
        >
          Change Avatar
        </button>
      </div>
      
      {showAvatarSelector && (
        <div className="mt-4 bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-700">
          <h3 className="text-white font-bold mb-3">Select Avatar</h3>
          {avatarError && <p className="text-red-400 text-sm mb-3">{avatarError}</p>}
          <div className="grid grid-cols-2 gap-3">
            {availableAvatars.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => handleAvatarChange(avatar.id)}
                className={`p-2 rounded-lg transition-all ${
                  user?.avatar_url === avatar.path || (avatar.id === 'intra' && user?.avatar_url === user?.original_avatar_url)
                    ? 'border-2 border-emerald-500' 
                    : 'border-2 border-slate-600 hover:border-emerald-400'
                }`}
              >
                <img 
                  src={avatar.path.startsWith('http') ? avatar.path : `${MEDIA_BASE_URL}/media/${avatar.path}`}
                  alt={avatar.label}
                  className="w-full h-20 object-cover rounded"
                />
                <p className="text-sm text-gray-300 mt-1 text-center truncate">{avatar.label}</p>
              </button>
            ))}
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

function FriendsManager() {
  const { user } = useContext(AuthContext);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addFriendId, setAddFriendId] = useState('');
  const [addFriendError, setAddFriendError] = useState('');
  const [addFriendSuccess, setAddFriendSuccess] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' or 'requests'

  const fetchFriends = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/social/friendships/accepted/`, {
        withCredentials: true,
      });
      setFriends(response.data || []);
    } catch (err) {
      console.error('Failed to fetch friends:', err);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/social/friendships/pending/`, {
        withCredentials: true,
      });
      setPendingRequests(response.data || []);
    } catch (err) {
      console.error('Failed to fetch pending requests:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        await Promise.all([fetchFriends(), fetchPendingRequests()]);
      } catch (err) {
        setError('Failed to load friends data');
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const handleAddFriend = async (e) => {
    e.preventDefault();
    setAddFriendError('');
    setAddFriendSuccess('');

    if (!addFriendId.trim()) {
      setAddFriendError('Please enter a user ID');
      return;
    }

    // Basic UUID validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(addFriendId.trim())) {
      setAddFriendError('Invalid user ID format');
      return;
    }

    setIsAdding(true);
    try {
      await axios.post(
        `${API_BASE_URL}/social/friendships/`,
        { user_id: addFriendId.trim() },
        { withCredentials: true }
      );
      setAddFriendSuccess('Friend request sent successfully!');
      setAddFriendId('');
      await fetchFriends();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to send friend request';
      setAddFriendError(errorMsg);
    } finally {
      setIsAdding(false);
    }
  };

  const handleAcceptRequest = async (friendshipId) => {
    try {
      await axios.post(
        `${API_BASE_URL}/social/friendships/${friendshipId}/accept/`,
        {},
        { withCredentials: true }
      );
      await Promise.all([fetchFriends(), fetchPendingRequests()]);
    } catch (err) {
      console.error('Failed to accept friend request:', err);
      setError('Failed to accept friend request');
    }
  };

  const handleRejectRequest = async (friendshipId) => {
    try {
      await axios.post(
        `${API_BASE_URL}/social/friendships/${friendshipId}/reject/`,
        {},
        { withCredentials: true }
      );
      await fetchPendingRequests();
    } catch (err) {
      console.error('Failed to reject friend request:', err);
      setError('Failed to reject friend request');
    }
  };

  const handleRemoveFriend = async (friendshipId) => {
    if (!window.confirm('Are you sure you want to remove this friend?')) {
      return;
    }

    try {
      await axios.delete(
        `${API_BASE_URL}/social/friendships/${friendshipId}/`,
        { withCredentials: true }
      );
      await fetchFriends();
    } catch (err) {
      console.error('Failed to remove friend:', err);
      setError('Failed to remove friend');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Friends</h2>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-slate-600">
        <button
          onClick={() => setActiveTab('friends')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === 'friends'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          My Friends ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 font-semibold transition-colors relative ${
            activeTab === 'requests'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Pending Requests ({pendingRequests.length})
          {pendingRequests.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('add')}
          className={`px-4 py-2 font-semibold transition-colors ${
            activeTab === 'add'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Add Friend
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : (
        <>
          {/* My Friends Tab */}
          {activeTab === 'friends' && (
            <div>
              {friends.length === 0 ? (
                <p className="text-gray-400">No friends yet. Add some friends to play with!</p>
              ) : (
                <div className="space-y-3">
                  {friends.map((friendship) => {
                    // Determine which user is the friend (not current user)
                    const friend = friendship.requester_data.id === user.id 
                      ? friendship.addressee_data 
                      : friendship.requester_data;
                    const avatarSrc = friend.avatar_url?.startsWith('http') 
                      ? friend.avatar_url 
                      : `${MEDIA_BASE_URL}/media/${friend.avatar_url}`;

                    return (
                      <div
                        key={friendship.id}
                        className="flex items-center justify-between bg-slate-700/50 p-4 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <img
                            src={avatarSrc}
                            alt={friend.username}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-white font-semibold">{friend.display_name}</p>
                            <p className="text-gray-400 text-sm">@{friend.username}</p>
                            <p className="text-gray-500 text-xs">
                              ID: {friend.id}
                              <button
                                onClick={() => copyToClipboard(friend.id)}
                                className="ml-2 text-emerald-400 hover:text-emerald-300"
                                title="Copy ID"
                              >
                                📋
                              </button>
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveFriend(friendship.id)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white font-semibold transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Pending Requests Tab */}
          {activeTab === 'requests' && (
            <div>
              {pendingRequests.length === 0 ? (
                <p className="text-gray-400">No pending friend requests</p>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((friendship) => {
                    const requester = friendship.requester_data;
                    const avatarSrc = requester.avatar_url?.startsWith('http') 
                      ? requester.avatar_url 
                      : `${MEDIA_BASE_URL}/media/${requester.avatar_url}`;

                    return (
                      <div
                        key={friendship.id}
                        className="flex items-center justify-between bg-slate-700/50 p-4 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <img
                            src={avatarSrc}
                            alt={requester.username}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-white font-semibold">{requester.display_name}</p>
                            <p className="text-gray-400 text-sm">@{requester.username}</p>
                            <p className="text-gray-500 text-xs">wants to be your friend</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptRequest(friendship.id)}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-md text-white font-semibold transition-colors"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleRejectRequest(friendship.id)}
                            className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-md text-white font-semibold transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Add Friend Tab */}
          {activeTab === 'add' && (
            <div>
              <div className="bg-blue-500/20 border border-blue-500 text-blue-200 px-4 py-3 rounded mb-4">
                <p className="font-semibold mb-2">How to add friends:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Ask your friend for their User ID</li>
                  <li>They can find it in the "My Friends" tab</li>
                  <li>Copy and paste their ID below</li>
                  <li>Your ID: <span className="font-mono bg-slate-700 px-2 py-1 rounded">{user?.id}</span>
                    <button
                      onClick={() => copyToClipboard(user?.id)}
                      className="ml-2 text-emerald-400 hover:text-emerald-300"
                      title="Copy my ID"
                    >
                      📋 Copy
                    </button>
                  </li>
                </ol>
              </div>

              <form onSubmit={handleAddFriend} className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2 font-semibold">
                    Friend's User ID
                  </label>
                  <input
                    type="text"
                    value={addFriendId}
                    onChange={(e) => setAddFriendId(e.target.value)}
                    placeholder="e.g., b6e0abbd-024c-4aa6-b2a7-d4fadb4d508b"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400"
                  />
                </div>

                {addFriendError && (
                  <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-2 rounded">
                    {addFriendError}
                  </div>
                )}

                {addFriendSuccess && (
                  <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-200 px-4 py-2 rounded">
                    {addFriendSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAdding}
                  className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-500 rounded-md text-white font-semibold transition-colors"
                >
                  {isAdding ? 'Sending...' : 'Send Friend Request'}
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Body() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto text-white">
      {/* Menu return button */}
      <div className="max-w-6xl mx-auto mb-4">
        <button
          onClick={() => navigate('/menu')}
          className="px-4 py-2 text-sm sm:text-base bg-slate-600 hover:bg-slate-700 rounded-md font-semibold transition-colors"
        >
          ← Back to Menu
        </button>
      </div>

      <DisplayNameEditor />
      <div className="grid grid-cols-2 gap-8 items-start">
        <PlayerStats />
        <Avatar />
      </div>
      <FriendsManager />
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
