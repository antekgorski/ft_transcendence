import React, { useContext, useState } from 'react';
import WelcomePage from './pages/WelcomePage';
import ProfilePage from './pages/ProfilePage';
import GameBoard from './pages/GameBoard';
import RuterPage from './pages/RuterPage';
import { AuthProvider, AuthContext } from './contexts/AuthContext';

function AppContent() {
  const { user, setUser, checkAuth } = useContext(AuthContext);
  const [currentPage, setCurrentPage] = useState(() => {
    if (!user) return 'router';
    const saved = localStorage.getItem('lastPage');
    return saved && (saved === 'game' || saved === 'profile') ? saved : 'router';
  });

  const handleLogin = (userData) => {
    // User data comes from backend - update context and recheck auth
    setUser(userData);
    checkAuth();
    // Po zalogowaniu sprawdź czy była zapisana strona
    const saved = localStorage.getItem('lastPage');
    if (saved && (saved === 'game' || saved === 'profile')) {
      setCurrentPage(saved);
    } else {
      setCurrentPage('router');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('router');
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

  if (!user) {
    return <WelcomePage onLogin={handleLogin} />;
  }

  if (currentPage === 'game') {
    return <GameBoard userData={user} onLogout={handleLogout} onNavigate={handleNavigate} />;
  }

  if (currentPage === 'profile') {
    return <ProfilePage userData={user} onLogout={handleLogout} onNavigate={handleNavigate} />;
  }

  return <RuterPage onNavigate={handleNavigate} />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
