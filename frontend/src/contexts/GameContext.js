import React, { createContext, useState, useCallback } from 'react';

/**
 * GameContext tracks whether the player is in an active game
 * and manages the direct-invite flow state.
 *
 * pendingInvite  – invite the current user *sent* and is waiting on:
 *   { inviteId, targetUserId, targetUsername, startedAt }  (startedAt = Date.now())
 *
 * receivedInvite – invite the current user *received*:
 *   { inviteId, fromUserId, fromUsername }
 *
 * inviteRejectedBy – username that rejected the last pending invite (cleared by consumer)
 */
export const GameContext = createContext({
  isGameActive: false,
  activeGameId: null,
  setActiveGame: () => { },
  clearActiveGame: () => { },
  onForfeitAndLeave: null,
  setOnForfeitAndLeave: () => { },
  pendingInvite: null,
  setPendingInvite: () => { },
  clearPendingInvite: () => { },
  receivedInvite: null,
  setReceivedInvite: () => { },
  clearReceivedInvite: () => { },
  inviteRejectedBy: null,
  setInviteRejectedBy: () => { },
  clearInviteRejectedBy: () => { },
});

export function GameProvider({ children }) {
  const [isGameActive, setIsGameActive] = useState(false);
  const [activeGameId, setActiveGameId] = useState(null);
  const [onForfeitAndLeave, setOnForfeitAndLeave] = useState(null);
  const [pendingInvite, setPendingInviteState] = useState(null);
  const [receivedInvite, setReceivedInviteState] = useState(null);
  const [inviteRejectedBy, setInviteRejectedByState] = useState(null);

  const setActiveGame = useCallback((gameId) => {
    setIsGameActive(true);
    setActiveGameId(gameId);
    setPendingInviteState(null);
    setReceivedInviteState(null);
  }, []);

  const clearActiveGame = useCallback(() => {
    setIsGameActive(false);
    setActiveGameId(null);
    setOnForfeitAndLeave(null);
  }, []);

  const setPendingInvite = useCallback((invite) => {
    setPendingInviteState(invite);
  }, []);

  const clearPendingInvite = useCallback(() => {
    setPendingInviteState(null);
  }, []);

  const setReceivedInvite = useCallback((invite) => {
    setReceivedInviteState(invite);
  }, []);

  const clearReceivedInvite = useCallback(() => {
    setReceivedInviteState(null);
  }, []);

  const setInviteRejectedBy = useCallback((username) => {
    setInviteRejectedByState(username);
  }, []);

  const clearInviteRejectedBy = useCallback(() => {
    setInviteRejectedByState(null);
  }, []);

  return (
    <GameContext.Provider value={{
      isGameActive,
      activeGameId,
      setActiveGame,
      clearActiveGame,
      onForfeitAndLeave,
      setOnForfeitAndLeave,
      pendingInvite,
      setPendingInvite,
      clearPendingInvite,
      receivedInvite,
      setReceivedInvite,
      clearReceivedInvite,
      inviteRejectedBy,
      setInviteRejectedBy,
      clearInviteRejectedBy,
    }}>
      {children}
    </GameContext.Provider>
  );
}
