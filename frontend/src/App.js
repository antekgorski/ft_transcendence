import React, { useContext, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import WelcomePage from './pages/WelcomePage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import UserProfilePage from './pages/UserProfilePage';
import GameBoard from './pages/GameBoard';
import RouterPage from './pages/RouterPage';
import LeaderboardPage from './pages/Leaderboard';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { GameProvider, GameContext } from './contexts/GameContext';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import { gameSocket } from './utils/socket';

function AppContent() {
  const { user } = useContext(AuthContext);
  const { setPendingInvite, setReceivedInvite, clearReceivedInvite, clearPendingInvite, setInviteRejectedBy } = useContext(GameContext);
  const navigate = useNavigate();

  // Keep fresh refs to context setters so WS handlers always use latest values
  const setPendingRef = useRef(setPendingInvite);
  const setReceivedRef = useRef(setReceivedInvite);
  const clearReceivedRef = useRef(clearReceivedInvite);
  const clearPendingRef = useRef(clearPendingInvite);
  const setRejectedByRef = useRef(setInviteRejectedBy);
  useEffect(() => { setPendingRef.current = setPendingInvite; }, [setPendingInvite]);
  useEffect(() => { setReceivedRef.current = setReceivedInvite; }, [setReceivedInvite]);
  useEffect(() => { clearReceivedRef.current = clearReceivedInvite; }, [clearReceivedInvite]);
  useEffect(() => { clearPendingRef.current = clearPendingInvite; }, [clearPendingInvite]);
  useEffect(() => { setRejectedByRef.current = setInviteRejectedBy; }, [setInviteRejectedBy]);

  // Global invite WebSocket handlers and initial state fetch
  useEffect(() => {
    if (!user) return;

    // Fetch any active invites on mount (e.g., after page refresh)
    const fetchActiveInvites = async () => {
      try {
        const { default: api } = await import('./utils/api');
        const res = await api.get('/games/invite/status/');
        if (res.data.type === 'received') {
          setReceivedRef.current({
            ...res.data.invite,
            receivedAt: res.data.invite.startedAt || Date.now(),
          });
        } else if (res.data.type === 'sent') {
          setPendingRef.current(res.data.invite);
        }
      } catch (err) {
        console.error('Failed to restore active invites:', err);
      }
    };
    fetchActiveInvites();

    const onInviteReceived = (data) => {
      setReceivedRef.current({
        inviteId: data.invite_id,
        fromUserId: data.from_user_id,
        fromUsername: data.from_username,
        receivedAt: Date.now(),
      });
    };

    const onInviteCancelled = () => {
      clearReceivedRef.current();
    };

    const onInviteAccepted = (data) => {
      clearPendingRef.current();
      if (data.game_id) {
        navigate('/game');
      }
    };

    const onInviteRejected = (data) => {
      clearPendingRef.current();
      setRejectedByRef.current(data.by_username);
    };

    gameSocket.on('invite_received', onInviteReceived);
    gameSocket.on('invite_cancelled', onInviteCancelled);
    gameSocket.on('invite_accepted', onInviteAccepted);
    gameSocket.on('invite_rejected', onInviteRejected);

    return () => {
      gameSocket.off('invite_received', onInviteReceived);
      gameSocket.off('invite_cancelled', onInviteCancelled);
      gameSocket.off('invite_accepted', onInviteAccepted);
      gameSocket.off('invite_rejected', onInviteRejected);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppContent />
        </BrowserRouter>
      </GameProvider>
    </AuthProvider>
  );
}

export default App;
