import React, { useContext } from 'react';
import WelcomePage from './pages/WelcomePage';
import ProfilePage from './pages/ProfilePage';
import { AuthProvider, AuthContext } from './contexts/AuthContext';

function AppContent() {
  const { user } = useContext(AuthContext);

  if (!user) {
    return <WelcomePage />;
  }

  return <ProfilePage />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
