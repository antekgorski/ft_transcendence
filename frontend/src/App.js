import React, { useState, useEffect } from 'react';
import WelcomePage from './pages/WelcomePage';
import GameBoard from './pages/GameBoard';
import ProfilePage from './pages/ProfilePage';
import { AuthProvider, AuthContext } from './contexts/AuthContext';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);

  // Check for saved user on component mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setUserData(user);
        setIsLoggedIn(true);
      } catch (err) {
        console.error('Failed to parse saved user:', err);
        localStorage.removeItem('user');
      }
    }
  }, []);

  const handleLogin = (user) => {
    setUserData(user);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUserData(null);
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return <WelcomePage onLogin={handleLogin} />;
function AppContent() {
  const { user } = useContext(AuthContext);

  if (!user) {
    return <WelcomePage />;
  }

  return <ProfilePage />;
}

function App() {
  return (
    <>
      {/*
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome to Battleship, {userData?.username || 'Player'}!</h1>
          <p className="text-gray-400 mb-2">{userData?.email}</p>
          <p className="text-gray-500 mb-6 text-sm">User ID: {userData?.id}</p>
          <p className="text-gray-400 mb-6">Game content coming soon...</p>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-md font-semibold transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
      */}
      <GameBoard userData={userData} onLogout={handleLogout} />
    </>
    </div>
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
