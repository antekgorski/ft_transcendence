import React, { useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';

function Template({ children }) {
  // remove use effect if not complient
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

export function ReturnToMenuButton() {
  return (
    <div className="max-w-6xl mx-auto mb-4">
      <Link
        to="/menu"
        className="inline-block px-4 py-2 text-sm sm:text-base bg-slate-600 hover:bg-slate-700 rounded-md font-semibold text-white transition-colors"
      >
        ← Back to Menu
      </Link>
    </div>
  );
}

function LogoutButton() {
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout/');
      setUser(null);
      localStorage.removeItem('user');
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
      // Still log out locally even if backend request fails
      setUser(null);
      localStorage.removeItem('user');
      navigate('/');
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


export { Template };
