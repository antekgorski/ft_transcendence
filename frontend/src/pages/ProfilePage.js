import React, { useState, useEffect, useContext } from 'react';
import API_BASE_URL from '../config';
import { AuthContext } from '../contexts/AuthContext';

// Helper to get CSRF token from cookie
function getCsrfToken() {
  const name = 'csrftoken';
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}



function Templete({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900">
      {/* Pasek na górze */}
      <nav className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <LogoHorizontal />
            </div>
            <div className="flex items-center gap-4">
              <LogoutButton />
            </div>
          </div>
        </div>
      </nav>
      
      {/* Główna zawartość strony */}
      <div className="p-5">
        {children}
      </div>
    </div>
  );
}

function LogoutButton() {
  const { setUser } = useContext(AuthContext);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout/`, {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-md font-semibold transition-colors"
    >
      Logout
    </button>
  );
}

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
      const response = await fetch(`${API_BASE_URL}/auth/profile/update/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify({ display_name: displayName.trim() })
      });

      if (response.ok) {
        await checkAuth();
        setIsEditing(false);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update display name');
      }
    } catch (err) {
      setError('Failed to update display name');
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
        const response = await fetch(`${API_BASE_URL}/games/stats/me/`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else {
          console.error('Failed to fetch stats, status:', response.status);
        }
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
            <p><span className="text-emerald-400 font-semibold">Best Game Duration:</span> {loading ? 'Loading...' : formatDuration(stats.bestGameDurationSeconds)}</p>
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


function Logo() {
  return (
    <div className="flex flex-col items-center gap-10 max-w-md w-full">
    <div className="text-center">
           <h1 className="text-5xl font-bold text-white tracking-wide drop-shadow-lg">
            ⚓ BATTLESHIP
          </h1>
           <p className="text-lg text-emerald-400 mt-2 tracking-wide">
            3D Tactical Multiplayer Game
         </p>
         </div>
    </div>
  );
}

function LogoHorizontal() {
  return (
    <div className="flex flex-row items-center gap-4">
      <span className="text-2xl ">⚓
      <span className="text-white font-bold text-xl">BATTLESHIP </span> 
      <span className="text-sm text-emerald-400 tracking-wide items-baseline">
        3D Tactical Multiplayer Game
      </span>
      </span>
    </div>
  );
}

function Avatar() {
  const { user, checkAuth } = useContext(AuthContext);
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  
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
      const csrfToken = getCsrfToken();
      console.log('CSRF Token:', csrfToken);
      console.log('Changing avatar to:', avatarId);
      const response = await fetch(`${API_BASE_URL}/auth/avatar/set/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        credentials: 'include',
        body: JSON.stringify({ avatar: avatarId })
      });
      console.log('Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Avatar changed:', data);
        await checkAuth(); // Refresh user data
        setShowAvatarSelector(false);
      } else {
        const errorData = await response.json();
        console.error('Avatar change failed:', errorData);
      }
    } catch (err) {
      console.error('Failed to update avatar:', err);
    }
  };

  const avatarSrc = user?.avatar_url?.startsWith('http') ? user.avatar_url : `http://localhost:8080/media/${user?.avatar_url}`;
  console.log('Avatar URL from user:', user?.avatar_url);
  console.log('Final avatar src:', avatarSrc);

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
                  src={avatar.path.startsWith('http') ? avatar.path : `http://localhost:8080/media/${avatar.path}`}
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

function Body() {
  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto">
      <DisplayNameEditor />
      <div className="grid grid-cols-2 gap-8 items-start">
        <PlayerStats />
        <Avatar />
      </div>
    </div>
  );
}

function ProfilePage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirm: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  
  return (
    <Templete>
      <Body />
    </Templete>
  );
}

export default ProfilePage;
