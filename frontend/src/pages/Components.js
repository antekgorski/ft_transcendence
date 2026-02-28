import React, { useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { GameContext } from '../contexts/GameContext';
import api from '../utils/api';
import { gameSocket } from '../utils/socket';

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

      {/* Global toasts */}
      <InviteToast />
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
      gameSocket.disconnect();
      setUser(null);
      localStorage.removeItem('user');
      navigate('/');
    } catch (err) {
      console.error('Logout error:', err);
      // Still log out locally even if backend request fails
      gameSocket.disconnect();
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

/**
 * InviteToast – displayed globally (via Template) when another player
 * sends the current user a game invite.
 *
 * The timer mirrors the 30-second invite TTL set on the backend.
 * When it reaches zero the toast auto-dismisses.
 */
const INVITE_TTL = 30; // seconds — must match backend Redis TTL

export function InviteToast() {
  const { receivedInvite, clearReceivedInvite } = useContext(GameContext);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);

  // Compute seconds left from the stored receivedAt timestamp so that
  // navigating away and remounting does not reset the countdown.
  const computeLeft = () => {
    if (!receivedInvite?.receivedAt) return INVITE_TTL;
    const elapsed = Math.floor((Date.now() - receivedInvite.receivedAt) / 1000);
    return Math.max(0, INVITE_TTL - elapsed);
  };

  const [secondsLeft, setSecondsLeft] = useState(computeLeft);

  useEffect(() => {
    if (!receivedInvite) {
      setSecondsLeft(INVITE_TTL);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }

    // Correct display immediately on (re)mount
    const initial = computeLeft();
    setSecondsLeft(initial);
    if (initial <= 0) { clearReceivedInvite(); return; }

    timerRef.current = setInterval(() => {
      const left = computeLeft();
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        clearReceivedInvite();
      }
    }, 1000);

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receivedInvite]);

  if (!receivedInvite) return null;

  const handleAccept = async () => {
    setBusy(true);
    try {
      const res = await api.post(`/games/invite/${receivedInvite.inviteId}/accept/`);
      clearReceivedInvite();
      if (res.data?.game_id) {
        navigate('/game');
      }
    } catch {
      // Invite may have expired; just dismiss
      clearReceivedInvite();
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await api.post(`/games/invite/${receivedInvite.inviteId}/reject/`);
    } catch {
      // Best-effort
    } finally {
      clearReceivedInvite();
      setBusy(false);
    }
  };

  return (
    <div className="fixed top-6 right-6 z-50 w-[26rem] max-w-[calc(100vw-2rem)] rounded-xl border border-amber-500/60 bg-slate-900/95 shadow-2xl backdrop-blur-sm p-4">
      {/* Header row: icon + title + timer */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚓</span>
          <p className="text-sm font-bold text-white">Game Invitation</p>
        </div>
        <span className="text-xs text-slate-400 tabular-nums shrink-0">{secondsLeft}s</span>
      </div>
      {/* Message */}
      <p className="text-sm text-slate-300 mb-3 leading-snug">
        <span className="text-amber-400 font-semibold">{receivedInvite.fromUsername}</span>
        {' '}challenges you to a naval battle!
      </p>
      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          disabled={busy}
          className="flex-1 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-3 py-2 text-sm font-semibold text-white transition-colors"
        >
          Accept
        </button>
        <button
          onClick={handleReject}
          disabled={busy}
          className="flex-1 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3 py-2 text-sm font-semibold text-white transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
