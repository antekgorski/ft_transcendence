import React, { useState, useEffect, useContext } from 'react';
import API_BASE_URL from '../config';
import { AuthContext } from '../contexts/AuthContext';




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
      await fetch(`${API_BASE_URL}/api/auth/logout/`, {
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


function PlayerStats() {
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState({
    level: null,
    wins: null,
    losses: null,
    winRate: null
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/stats/me/`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    };
    if (user?.id) {
      fetchStats();
    }
  }, [user?.id]);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
      <h2 className="text-2xl font-bold text-white mb-4">Player Profile</h2>
      <div className="text-gray-300 space-y-3">
        <p><span className="text-emerald-400 font-semibold">Username:</span> {user?.username || 'Loading...'}</p>
        <p><span className="text-emerald-400 font-semibold">Display Name:</span> {user?.display_name || 'N/A'}</p>
        <p><span className="text-emerald-400 font-semibold">Email:</span> {user?.email || 'N/A'}</p>
        <p><span className="text-emerald-400 font-semibold">Level:</span> {stats.level !== null ? stats.level : 'Loading...'}</p>
        <p><span className="text-emerald-400 font-semibold">Wins:</span> {stats.wins !== null ? stats.wins : 'Loading...'}</p>
        <p><span className="text-emerald-400 font-semibold">Losses:</span> {stats.losses !== null ? stats.losses : 'Loading...'}</p>
        <p><span className="text-emerald-400 font-semibold">Win Rate:</span> {stats.winRate !== null ? `${stats.winRate}%` : 'Loading...'}</p>
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
  const [selectedAvatar, setSelectedAvatar] = useState('player-avatar.jpg');
  const [showAvatarSelector, setShowAvatarSelector] = useState(false);
  
  const availableAvatars = [
    'player-avatar.jpg',
    'avatar-2.jpg',
    'avatar-3.jpg',
    'avatar-4.jpg'
  ];

  return (
    <div className="flex flex-col">
      <div className="relative">
        <img 
          src={`${API_BASE_URL}/media/${selectedAvatar}`} 
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
                key={avatar}
                onClick={() => {
                  setSelectedAvatar(avatar);
                  setShowAvatarSelector(false);
                }}
                className={`p-2 rounded-lg transition-all ${
                  selectedAvatar === avatar 
                    ? 'border-2 border-emerald-500' 
                    : 'border-2 border-slate-600 hover:border-emerald-400'
                }`}
              >
                <img 
                  src={`${API_BASE_URL}/media/${avatar}`} 
                  alt={avatar}
                  className="w-full h-20 object-cover rounded"
                />
                <p className="text-sm text-gray-300 mt-1 text-center truncate">{avatar}</p>
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
    <div className="grid grid-cols-2 gap-8 w-full max-w-6xl mx-auto items-start">
      <PlayerStats />
      <Avatar />
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
