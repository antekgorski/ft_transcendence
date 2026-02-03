import React, { useContext } from 'react';
import WelcomePage from './pages/WelcomePage';
import ProfilePage from './pages/ProfilePage';
import { AuthProvider, AuthContext } from './contexts/AuthContext';

function AppContent() {
  const { user, setUser, checkAuth } = useContext(AuthContext);

  const handleLogin = (userData) => {
    // User data comes from backend - update context and recheck auth
    setUser(userData);
    checkAuth();
  };

  const handleLogout = () => {
    setUser(null);
  };

  if (!user) {
    return <WelcomePage onLogin={handleLogin} />;
  }

  return (
    // <>
    //   <GameBoard userData={user} onLogout={handleLogout} />
    // </>
    <ProfilePage userData={user} onLogout={handleLogout} />
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
