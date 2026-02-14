import React, { useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../config';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';


function Template({ children }) {
  // remove use effect if not complient
  useEffect(() => {
    const prevHtmlGutter = document.documentElement.style.scrollbarGutter;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    const prevBodyBg = document.body.style.backgroundColor;

    document.documentElement.style.scrollbarGutter = 'stable';
    document.documentElement.style.backgroundColor = '#0f172a';
    document.body.style.backgroundColor = '#0f172a';

    return () => {
      document.documentElement.style.scrollbarGutter = prevHtmlGutter;
      document.documentElement.style.backgroundColor = prevHtmlBg;
      document.body.style.backgroundColor = prevBodyBg;
    };
  }, []);

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
  const navigate = useNavigate();
  return (
          <div className="max-w-6xl mx-auto mb-4">
        <button
          onClick={() => navigate('/menu')}
          className="px-4 py-2 text-sm sm:text-base bg-slate-600 hover:bg-slate-700 rounded-md font-semibold transition-colors"
        >
          ← Back to Menu
        </button>
      </div>
  );}

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


export { Template };
