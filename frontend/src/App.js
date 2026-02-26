import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import WelcomePage from './pages/WelcomePage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import UserProfilePage from './pages/UserProfilePage';
import GameBoard from './pages/GameBoard';
import RouterPage from './pages/RouterPage';
import LeaderboardPage from './pages/Leaderboard';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';

function AppContent() {
  const { user } = useContext(AuthContext);

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/menu" element={<RouterPage />} />
      <Route path="/game" element={<GameBoard />} />
      <Route path="/profile/:userId" element={<UserProfilePage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="*" element={<Navigate to="/menu" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <GameProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </GameProvider>
    </AuthProvider>
  );
}

export default App;

