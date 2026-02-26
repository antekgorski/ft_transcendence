import React, { createContext, useState, useCallback } from 'react';

/**
 * GameContext tracks whether the player is in an active game.
 * Used by LogoutButton and navigation guards to warn before leaving.
 */
export const GameContext = createContext({
  isGameActive: false,
  activeGameId: null,
  setActiveGame: () => {},
  clearActiveGame: () => {},
  onForfeitAndLeave: null, // callback set by GameBoard
  setOnForfeitAndLeave: () => {},
});

export function GameProvider({ children }) {
  const [isGameActive, setIsGameActive] = useState(false);
  const [activeGameId, setActiveGameId] = useState(null);
  const [onForfeitAndLeave, setOnForfeitAndLeave] = useState(null);

  const setActiveGame = useCallback((gameId) => {
    setIsGameActive(true);
    setActiveGameId(gameId);
  }, []);

  const clearActiveGame = useCallback(() => {
    setIsGameActive(false);
    setActiveGameId(null);
    setOnForfeitAndLeave(null);
  }, []);

  return (
    <GameContext.Provider value={{
      isGameActive,
      activeGameId,
      setActiveGame,
      clearActiveGame,
      onForfeitAndLeave,
      setOnForfeitAndLeave,
    }}>
      {children}
    </GameContext.Provider>
  );
}
