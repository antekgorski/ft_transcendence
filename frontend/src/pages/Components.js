import React, { useContext, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { GameContext } from '../contexts/GameContext';
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
  const { isGameActive, onForfeitAndLeave } = useContext(GameContext);
  const [showConfirm, setShowConfirm] = useState(false);

  const doLogout = async () => {
    try {
      // If in an active game, forfeit first
      if (isGameActive && onForfeitAndLeave) {
        await onForfeitAndLeave();
      }
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

  const handleLogout = () => {
    if (isGameActive) {
      setShowConfirm(true);
    } else {
      doLogout();
    }
  };

  return (
    <>
      <button
        onClick={handleLogout}
        className="px-3 py-2 sm:px-6 bg-emerald-500 hover:bg-emerald-600 rounded-md font-semibold transition-colors"
      >
        Logout
      </button>
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-red-500 rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Logout During Game?</h3>
            <p className="text-slate-300 mb-6">
              Logging out will <span className="text-red-400 font-bold">forfeit</span> your current game. You will lose.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded font-semibold text-white transition-colors"
                onClick={() => setShowConfirm(false)}
              >
                Stay in Game
              </button>
              <button
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold text-white transition-colors"
                onClick={() => {
                  setShowConfirm(false);
                  doLogout();
                }}
              >
                Forfeit & Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LogoHorizontal() {
  return (
    <div className="flex flex-row items-center gap-4">
      <span className="text-xl sm:text-2xl">⚓
        <span className="text-white font-bold text-base sm:text-xl">BATTLESHIPS </span>
        <span className="hidden sm:inline text-sm text-emerald-400 tracking-wide items-baseline">
          Tactical Online Game
        </span>
      </span>
    </div>
  );
}


export { Template };
