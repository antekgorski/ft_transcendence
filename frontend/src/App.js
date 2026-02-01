import React, { useContext } from 'react';
import WelcomePage from './pages/WelcomePage';
import ProfilePage from './pages/ProfilePage';
import { AuthProvider, AuthContext } from './contexts/AuthContext';

function AppContent() {
  const { user, setUser, checkAuth } = useContext(AuthContext);

  const handleLogin = (userData) => {
    // Dane użytkownika już przyszły z backendu (przez WelcomePage)
    // Zapisz do localStorage i ustaw w kontekście
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  if (!user) {
    return <WelcomePage onLogin={handleLogin} />;
  }

  return (
    <>
      <GameBoard userData={user} onLogout={handleLogout} />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
