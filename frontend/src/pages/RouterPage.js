import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Template } from './Components';
import { GameContext } from '../contexts/GameContext';
import api from '../utils/api';
import { gameSocket } from '../utils/socket';

const INVITE_TIMEOUT = 30; // seconds — must match invite TTL on backend

// ---------------------------------------------------------------------------
// PlayerListModal – shows online, available players to invite
// ---------------------------------------------------------------------------
function PlayerListModal({ onClose, onInviteSent, hasIncomingInvite }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(null); // userId currently being invited
  const [error, setError] = useState('');
  const pollRef = useRef(null);
  const mountedRef = useRef(true);

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await api.get('/games/online-players/');
      if (mountedRef.current) {
        setPlayers(res.data?.players || []);
      }
    } catch {
      // silently ignore transient errors
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchPlayers();
    pollRef.current = setInterval(fetchPlayers, 3000);
    return () => {
      mountedRef.current = false;
      clearInterval(pollRef.current);
    };
  }, [fetchPlayers]);

  const handleInvite = async (player) => {
    setInviting(player.id);
    setError('');
    try {
      const res = await api.post('/games/invite/', { user_id: player.id });
      if (res.data?.error) {
        setError(res.data.error);
        setInviting(null);
        return;
      }
      onInviteSent({
        inviteId: res.data.invite_id,
        targetUserId: player.id,
        targetUsername: player.username,
      });
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not send invite.';
      setError(msg);
      setInviting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-white">Online Players</h3>
            <p className="text-xs text-slate-400 mt-0.5">Select a player to challenge</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Player list */}
        <div className="max-h-72 overflow-y-auto px-2 py-2">
          {loading && (
            <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
          )}

          {!loading && players.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">
              No players available right now.
            </p>
          )}

          {!loading && players.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {p.is_friend && (
                  <span title="Friend" className="text-amber-400 text-sm leading-none">★</span>
                )}
                <span className="font-medium text-white truncate">
                  {p.username}
                </span>
                {p.is_friend && (
                  <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                    friend
                  </span>
                )}
              </div>

              <button
                onClick={() => handleInvite(p)}
                disabled={inviting !== null || hasIncomingInvite}
                title={hasIncomingInvite ? 'Respond to your pending invite first' : undefined}
                className="shrink-0 rounded-md bg-amber-500 hover:bg-amber-600 disabled:opacity-50 px-3 py-1.5 text-sm font-semibold text-white transition-colors"
              >
                {inviting === p.id ? 'Inviting…' : 'Invite'}
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p className="mx-4 mb-2 rounded-md border border-red-500/40 bg-red-500/20 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <p className="px-5 pb-4 text-xs text-slate-500">
          List refreshes every 3 s. ★ marks your friends.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Body – main menu & invite state management
// ---------------------------------------------------------------------------
function Body() {
  const navigate = useNavigate();
  const {
    pendingInvite, setPendingInvite, clearPendingInvite,
    inviteRejectedBy, clearInviteRejectedBy,
    receivedInvite,
    clearReceivedInvite,
  } = useContext(GameContext);

  const [showPlayerList, setShowPlayerList] = useState(false);
  const [showTimeoutMsg, setShowTimeoutMsg] = useState(false);
  const tickRef = useRef(null);
  const timeoutMsgTimerRef = useRef(null);

  // Derive remaining seconds from startedAt so remounting doesn't reset display
  const computeSecondsLeft = () => {
    if (!pendingInvite?.startedAt) return INVITE_TIMEOUT;
    const elapsed = Math.floor((Date.now() - pendingInvite.startedAt) / 1000);
    return Math.max(0, INVITE_TIMEOUT - elapsed);
  };

  const [secondsLeft, setSecondsLeft] = useState(computeSecondsLeft);

  // Sync seconds display every second while an invite is pending
  useEffect(() => {
    if (!pendingInvite) {
      setSecondsLeft(INVITE_TIMEOUT);
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }

    // Correct display immediately after remount
    const initial = computeSecondsLeft();
    setSecondsLeft(initial);

    // If already expired when we mount (shouldn't normally happen), cancel now
    if (initial <= 0) {
      doCancel(true);
      return;
    }

    tickRef.current = setInterval(() => {
      const left = computeSecondsLeft();
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(tickRef.current);
        tickRef.current = null;
        doCancel(true);
      }
    }, 1000);

    return () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInvite]);

  // Clear the rejection notice after 5 s
  useEffect(() => {
    if (!inviteRejectedBy) return;
    const t = setTimeout(() => clearInviteRejectedBy(), 5000);
    return () => clearTimeout(t);
  }, [inviteRejectedBy, clearInviteRejectedBy]);

  // Clean up on unmount
  useEffect(() => () => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (timeoutMsgTimerRef.current) clearTimeout(timeoutMsgTimerRef.current);
  }, []);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const handleInviteSent = (invite) => {
    setShowTimeoutMsg(false);
    setPendingInvite({ ...invite, startedAt: Date.now() });
    setShowPlayerList(false);
  };

  const doCancel = async (isTimeout = false) => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    try {
      await api.post('/games/invite/cancel/');
    } catch {
      // best-effort; invite may have already expired in Redis
    }
    clearPendingInvite();
    if (isTimeout) {
      setShowTimeoutMsg(true);
      if (timeoutMsgTimerRef.current) clearTimeout(timeoutMsgTimerRef.current);
      timeoutMsgTimerRef.current = setTimeout(() => setShowTimeoutMsg(false), 5000);
    }
  };

  const handlePlayAgainstAi = async (e) => {
    e.preventDefault();

    if (isBusy) {
      return;
    }

    // If user has an incoming PvP invite, reject it automatically before starting AI.
    if (receivedInvite?.inviteId) {
      try {
        await api.post(`/games/invite/${receivedInvite.inviteId}/reject/`);
      } catch {
        // Best effort; proceed to AI flow even if invite already expired/handled.
      } finally {
        clearReceivedInvite();
      }
    }

    navigate('/game', { state: { startAI: true } });
  };

  const isBusy = !!pendingInvite;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8">
      <h2 className="px-4 text-center text-2xl font-bold text-white sm:text-4xl">
        Choose Your Destination
      </h2>

      {/* Main action buttons */}
      <div className="grid w-full max-w-6xl grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/game"
          state={{ startAI: true }}
          onClick={handlePlayAgainstAi}
          className={`flex w-full items-center justify-center rounded-lg bg-emerald-500 px-6 py-3 text-center text-base font-bold text-white shadow-lg transition-colors hover:bg-emerald-600 sm:py-4 sm:text-lg lg:text-xl${isBusy ? ' pointer-events-none opacity-50' : ''}`}
        >
          Play Against AI
        </Link>

        <button
          onClick={() => !isBusy && setShowPlayerList(true)}
          disabled={isBusy}
          className="w-full rounded-lg bg-amber-500 px-6 py-3 text-center text-base font-bold text-white shadow-lg transition-colors hover:bg-amber-600 disabled:opacity-50 sm:py-4 sm:text-lg lg:text-xl"
        >
          Play Against Player
        </button>

        <Link
          to="/profile"
          className="flex w-full items-center justify-center rounded-lg bg-blue-500 px-6 py-3 text-center text-base font-bold text-white shadow-lg transition-colors hover:bg-blue-600 sm:py-4 sm:text-lg lg:text-xl"
        >
          View Profile
        </Link>

        <Link
          to="/leaderboard"
          className="flex w-full items-center justify-center rounded-lg bg-purple-500 px-6 py-3 text-center text-base font-bold text-white shadow-lg transition-colors hover:bg-purple-600 sm:py-4 sm:text-lg lg:text-xl"
        >
          View Leaderboard
        </Link>
      </div>

      {/* Pending invite panel */}
      {pendingInvite && (
        <div className="mx-4 w-full max-w-md rounded-lg border border-amber-500/60 bg-slate-900/60 px-6 py-4 text-center text-white">
          <p className="text-lg font-semibold">⚔️ Waiting for response…</p>
          <p className="mt-1 text-sm text-slate-300">
            Invite sent to{' '}
            <span className="font-medium text-amber-400">{pendingInvite.targetUsername}</span>
          </p>
          <p className="mt-0.5 text-sm text-slate-400">Expires in {secondsLeft}s</p>
          <button
            onClick={() => doCancel(false)}
            className="mt-3 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold transition-colors hover:bg-slate-600"
          >
            Cancel Invitation
          </button>
        </div>
      )}

      {/* Status feedback */}
      {inviteRejectedBy && (
        <div className="mx-4 w-full max-w-md rounded-lg border border-red-500/60 bg-red-500/20 px-6 py-3 text-center text-red-200">
          <span className="font-medium">{inviteRejectedBy}</span> declined your invitation.
        </div>
      )}
      {!pendingInvite && !inviteRejectedBy && showTimeoutMsg && (
        <div className="mx-4 w-full max-w-md rounded-lg border border-slate-600/60 bg-slate-700/40 px-6 py-3 text-center text-slate-300">
          Invitation timed out — no response from the other player.
        </div>
      )}

      {/* Online player list modal */}
      {showPlayerList && (
        <PlayerListModal
          onClose={() => setShowPlayerList(false)}
          onInviteSent={handleInviteSent}
          hasIncomingInvite={!!receivedInvite}
        />
      )}
    </div>
  );
}

function RouterPage() {
  useEffect(() => {
    gameSocket.preConnect();
  }, []);

  return (
    <Template>
      <Body />
    </Template>
  );
}

export default RouterPage;
