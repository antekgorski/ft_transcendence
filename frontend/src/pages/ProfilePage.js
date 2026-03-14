import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <p><span className="text-emerald-400 font-semibold">Email:</span> {user?.email || 'N/A'}</p>

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

function FriendsManager() {
  const { user } = useContext(AuthContext);
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [requestMessage, setRequestMessage] = useState('');

  const getAvatarUrl = (path) => {
    if (!path) return '/media/avatars/avatar_1.jpg';
    if (path.startsWith('http')) return path;
    if (path.startsWith('/media/')) return path;
    return `/media/${path}`;
  };

  const fetchFriendsData = async (showLoading = false) => {
      if (showLoading) setFriendsLoading(true);
      setFriendsError('');
      try {
        const [acceptedResponse, pendingResponse, sentResponse] = await Promise.all([
          api.get('/social/friendships/accepted/'),
          api.get('/social/friendships/pending/'),
          api.get('/social/friendships/sent/'),
        ]);
          setFriends(acceptedResponse.data || []);
          setPendingRequests(pendingResponse.data || []);
          setSentRequests(sentResponse.data || []);
      } catch (err) {
          console.error('Failed to load friends data:', err);
          if (showLoading) setFriendsError('Failed to load friends data.');
      } finally {
      setFriendsLoading(false);
      }
    };

  useEffect(() => {
    if (user?.id) {
      fetchFriendsData(true);
      const interval = setInterval(fetchFriendsData, 5000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  const handleSearch = async (event) => {
    event.preventDefault();
    setSearchError('');
    setRequestMessage('');
    setSearchResults([]);

    if (searchQuery.trim().length < 2) {
      setSearchError('Enter at least 2 characters.');
      return;
    }

    setSearchLoading(true);
    try {
      const response = await api.get('/auth/users/search/', {
        params: { q: searchQuery.trim() },
      });
      setSearchResults(response.data?.results || []);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Search failed.';
      setSearchError(errorMsg);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendRequest = async (userId) => {
    setRequestMessage('');
    setSearchError('');
    try {
      await api.post('/social/friendships/', { user_id: userId });
      setRequestMessage('Friend request sent.');
      await fetchFriendsData();
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to send request.';
      setSearchError(errorMsg);
    }
  };

  const handleCancelRequest = async (friendshipId) => {
    setFriendsError('');
    try {
      await api.delete(`/social/friendships/${friendshipId}/`);
      await fetchFriendsData();
    } catch (err) {
      console.error('Failed to cancel request:', err);
      setFriendsError('Failed to cancel request.');
    }
  };

  // Determine friendship status for a given user ID
  const getFriendshipStatus = (userId) => {
    const isFriend = friends.some(
      (f) => f.requester_data?.id === userId || f.addressee_data?.id === userId
    );
    if (isFriend) return 'accepted';

    const isPendingIncoming = pendingRequests.some(
      (f) => f.requester_data?.id === userId
    );
    if (isPendingIncoming) return 'pending_incoming';

    const isPendingSent = sentRequests.some(
      (f) => f.addressee_data?.id === userId
    );
    if (isPendingSent) return 'pending_sent';

    return null;
  };

  const handleAcceptRequest = async (friendshipId) => {
    setFriendsError('');
    try {
      await api.post(`/social/friendships/${friendshipId}/accept/`);
      fetchFriendsData();
    } catch (err) {
      console.error('Failed to accept request:', err);
      setFriendsError('Failed to accept request.');
    }
  };

  const handleRejectRequest = async (friendshipId) => {
    setFriendsError('');
    try {
      await api.post(`/social/friendships/${friendshipId}/reject/`);
      fetchFriendsData();
    } catch (err) {
      console.error('Failed to reject request:', err);
      setFriendsError('Failed to reject request.');
    }
  };

  const handleRemoveFriend = async (friendshipId) => {
    setFriendsError('');
    try {
      await api.delete(`/social/friendships/${friendshipId}/`);
      fetchFriendsData();
    } catch (err) {
      console.error('Failed to remove friend:', err);
      setFriendsError('Failed to remove friend.');
    }
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Friends</h2>

      {friendsError && (
        <p className="text-red-400 mb-4">{friendsError}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-emerald-400 mb-3">Search by Username</h3>
          <form onSubmit={handleSearch} className="space-y-3">
            <input
              id="friend-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type a username or display name"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-gray-400"

            />
            <button
              type="submit"
              disabled={searchLoading}
              className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-500 rounded-md text-white font-semibold transition-colors"
            >
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchError && (
            <p className="text-red-400 text-sm mt-2">{searchError}</p>
          )}
          {requestMessage && (
            <p className="text-emerald-400 text-sm mt-2">{requestMessage}</p>
          )}

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="flex flex-col gap-3 rounded-lg bg-slate-700/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link to={`/profile/${result.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80 transition-opacity">
                    <img
                      src={getAvatarUrl(result.avatar_url)}
                      alt={result.username}
                      className="w-10 h-10 rounded-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/media/avatars/avatar_1.jpg';
                      }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-white font-semibold">{result.display_name || result.username}</p>
                      <p className="truncate text-sm text-gray-400">@{result.username}</p>
                    </div>
                  </Link>
                  {(() => {
                    const status = getFriendshipStatus(result.id);
                    if (status === 'accepted') {
                      return (
                        <span className="self-end rounded-md bg-emerald-600/30 px-3 py-2 text-sm font-semibold text-emerald-400 sm:self-auto">
                          Friends
                        </span>
                      );
                    }
                    if (status === 'pending_sent') {
                      return (
                        <span className="self-end rounded-md bg-yellow-600/30 px-3 py-2 text-sm font-semibold text-yellow-400 sm:self-auto">
                          Pending
                        </span>
                      );
                    }
                    if (status === 'pending_incoming') {
                      return (
                        <span className="self-end rounded-md bg-blue-600/30 px-3 py-2 text-sm font-semibold text-blue-400 sm:self-auto">
                          Respond
                        </span>
                      );
                    }
                    return (
                      <button
                        onClick={() => handleSendRequest(result.id)}
                        className="self-end rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 sm:self-auto"
                      >
                        Add
                      </button>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-emerald-400 mb-3">Pending Requests</h3>
          {friendsLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : pendingRequests.length === 0 ? (
            <p className="text-gray-400">No pending requests.</p>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map((request) => {
                const requester = request.requester_data;
                return (
                  <div
                    key={request.id}
                    className="flex flex-col gap-3 rounded-lg bg-slate-700/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link to={`/profile/${requester?.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80 transition-opacity">
                      <img
                        src={getAvatarUrl(requester?.avatar_url)}
                        alt={requester?.username}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/media/avatars/avatar_1.jpg';
                        }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-white font-semibold">{requester?.display_name || requester?.username}</p>
                        <p className="truncate text-sm text-gray-400">@{requester?.username}</p>
                      </div>
                    </Link>
                    <div className="flex w-full justify-end gap-2 sm:w-auto">
                      <button
                        onClick={() => handleAcceptRequest(request.id)}
                        className="px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md text-sm font-semibold"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRejectRequest(request.id)}
                        className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-md text-sm font-semibold"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <h3 className="text-lg font-semibold text-emerald-400 mb-3 mt-6">Sent Requests</h3>
          {friendsLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : sentRequests.length === 0 ? (
            <p className="text-gray-400">No sent requests.</p>
          ) : (
            <div className="space-y-2">
              {sentRequests.map((request) => {
                const addressee = request.addressee_data;
                return (
                  <div
                    key={request.id}
                    className="flex flex-col gap-3 rounded-lg bg-slate-700/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link to={`/profile/${addressee?.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80 transition-opacity">
                      <img
                        src={getAvatarUrl(addressee?.avatar_url)}
                        alt={addressee?.username}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/media/avatars/avatar_1.jpg';
                        }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-white font-semibold">{addressee?.display_name || addressee?.username}</p>
                        <p className="truncate text-sm text-gray-400">@{addressee?.username}</p>
                      </div>
                    </Link>
                    <div className="flex w-full flex-wrap justify-end items-center gap-2 sm:w-auto">
                      <span className="px-2 py-1 bg-yellow-600/30 text-yellow-400 rounded text-xs font-semibold">
                        Pending
                      </span>
                      <button
                        onClick={() => handleCancelRequest(request.id)}
                        className="px-3 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-md text-sm font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <h3 className="text-lg font-semibold text-emerald-400 mb-3 mt-6">Friends List</h3>
          {friendsLoading ? (
            <p className="text-gray-400">Loading...</p>
          ) : friends.length === 0 ? (
            <p className="text-gray-400">No friends yet.</p>
          ) : (
            <div className="space-y-2">
              {friends.map((friendship) => {
                const friend = friendship.requester_data?.id === user?.id
                  ? friendship.addressee_data
                  : friendship.requester_data;
                return (
                  <div
                    key={friendship.id}
                    className="flex flex-col gap-3 rounded-lg bg-slate-700/50 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link to={`/profile/${friend?.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80 transition-opacity">
                      <img
                        src={getAvatarUrl(friend?.avatar_url)}
                        alt={friend?.username}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/media/avatars/avatar_1.jpg';
                        }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-white font-semibold">{friend?.display_name || friend?.username}</p>
                        <p className="truncate text-sm text-gray-400">@{friend?.username}</p>
                      </div>
                    </Link>
                    <button
                      onClick={() => handleRemoveFriend(friendship.id)}
                      className="self-end rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 sm:self-auto"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
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
                    <td className="py-3 px-4">
                      {game.opponent_id && game.game_type !== 'ai' ? (
                        <Link to={`/profile/${game.opponent_id}`} className="text-blue-400 hover:text-blue-300 hover:underline transition-colors">
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
  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto text-white">
      {/* Menu return button */}
      <ReturnToMenuButton />
      <DisplayNameEditor />
      <div className="grid grid-cols-1 gap-8 items-start lg:grid-cols-2">
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
