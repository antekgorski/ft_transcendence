import React, { useContext, useState, useEffect } from 'react';
import WelcomePage from './pages/WelcomePage';
import ProfilePage from './pages/ProfilePage';
import GameBoard from './pages/GameBoard';
import RouterPage from './pages/RouterPage';
import { AuthProvider, AuthContext } from './contexts/AuthContext';

function AppContent() {
  const { user, setUser, checkAuth } = useContext(AuthContext);
  const [currentPage, setCurrentPage] = useState('welcome');

  useEffect(() => {
    if (!user) {
      setCurrentPage('welcome');
      return;
    }
    const saved = localStorage.getItem('lastPage');
    setCurrentPage(saved && (saved === 'game' || saved === 'profile') ? saved : 'router');
  }, [user]);

  const handleLogin = (userData) => {
    // User data comes from backend - update context and recheck auth
    setUser(userData);
    checkAuth();
    // After login check if page was saved
    const saved = localStorage.getItem('lastPage');
    if (saved && (saved === 'game' || saved === 'profile')) {
      setCurrentPage(saved);
    } else {
      setCurrentPage('router');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('welcome');
    localStorage.removeItem('lastPage');
  };

  const handleNavigate = (page) => {
    setCurrentPage(page);
    if (page !== 'router') {
      localStorage.setItem('lastPage', page);
    } else {
      localStorage.removeItem('lastPage');
    }
  };

  if (currentPage === 'welcome') {
    return <WelcomePage onLogin={handleLogin} />;
  }

  if (!user) {
    return <WelcomePage onLogin={handleLogin} />;
  }

  if (currentPage === 'game') {
    return <GameBoard userData={user} onLogout={handleLogout} onNavigate={handleNavigate} />;
  }

  if (currentPage === 'profile') {
    return <ProfilePage userData={user} onLogout={handleLogout} onNavigate={handleNavigate} />;
  }

  return <RouterPage onNavigate={handleNavigate} />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
