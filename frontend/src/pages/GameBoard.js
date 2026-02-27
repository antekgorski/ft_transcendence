// Importujemy React i hooki do zarządzania stanem komponentu.
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Template } from './Components';
import API_BASE_URL from '../config';
import { AuthContext } from '../contexts/AuthContext';
import { GameContext } from '../contexts/GameContext';
import { gameSocket } from '../utils/socket';


// Deklarujemy stałą z rozmiarem planszy (10x10).
const BOARD_SIZE = 10;

// Deklarujemy stałą z listą statusów pól planszy.
const CELL_TYPES = {
  // Pole puste bez statku i bez strzału.
  EMPTY: 'empty',
  // Pole ze statkiem (prywatna plansza gracza).
  SHIP: 'ship',
  // Pole, które zostało trafione.
  HIT: 'hit',
  // Pole, które zostało ostrzelane i było puste.
  MISS: 'miss',
};

// Funkcja pomocnicza tworząca pustą planszę 10x10.
const createEmptyBoard = () => {
  // Tworzymy tablicę wierszy o długości BOARD_SIZE.
  return Array.from({ length: BOARD_SIZE }, () => {
    // W każdym wierszu tworzymy tablicę kolumn o długości BOARD_SIZE.
    return Array.from({ length: BOARD_SIZE }, () => {
      // Każde pole startuje jako EMPTY.
      return CELL_TYPES.EMPTY;
    });
  });
};

// Główny komponent GameBoard z logiką gry przeniesiony do Body.
function Body() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const { setActiveGame, clearActiveGame, setOnForfeitAndLeave, clearPendingInvite, clearReceivedInvite } = useContext(GameContext);

  // Unconditionally wipe any dashboard invite state the moment the game UI loads
  useEffect(() => {
    clearPendingInvite();
    clearReceivedInvite();
  }, [clearPendingInvite, clearReceivedInvite]);

  // Ref to prevent concurrent initialization
  const initializingRef = useRef(false);

  // Stan gry
  const [gameId, setGameId] = useState(null);
  const [gameLoading, setGameLoading] = useState(true);
  const [error, setError] = useState(null);
  const [gameInitialized, setGameInitialized] = useState(false);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [showLoadingBanner, setShowLoadingBanner] = useState(false);

  // Stan planszy gracza (własne statki).
  const [playerBoard, setPlayerBoard] = useState(createEmptyBoard);
  // Stan planszy przeciwnika (gdzie oddajemy strzały).
  const [enemyBoard, setEnemyBoard] = useState(createEmptyBoard);
  // Stan określający, czy jesteśmy w trybie rozmieszczania statków.
  const [isPlacingShips, setIsPlacingShips] = useState(true);
  // Stan z informacją o orientacji statku.
  const [orientation, setOrientation] = useState('horizontal');
  // Stan komunikatu dla użytkownika.
  const [statusMessage, setStatusMessage] = useState('Place your ships on your board.');

  // Lista statków do rozmieszczenia z ich pozycjami
  const [placedShips, setPlacedShips] = useState([]);

  // Stan dla drag and drop
  const [draggedShip, setDraggedShip] = useState(null);
  const [hoverCell, setHoverCell] = useState(null);
  const [dragRestore, setDragRestore] = useState(null);
  const [didDrop, setDidDrop] = useState(false);
  const dragBaseRef = useRef(null);
  const didDropRef = useRef(false);
  const draggedShipRef = useRef(null);
  const touchGestureRef = useRef(null);
  const suppressNextClickRef = useRef(false);
  const [isTouchGestureActive, setIsTouchGestureActive] = useState(false);

  // Stan dla forfeit
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);
  const [gameResult, setGameResult] = useState(null); // 'win', 'lose', or null
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const [shotHistory, setShotHistory] = useState([]);

  // Stan dla czatu w grze
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const chatScrollRef = useRef(null); // ref to messages container (for in-box scroll)
  const chatEndRef = useRef(null);    // sentinel div inside the box
  const [chatToast, setChatToast] = useState(null); // { message, senderUsername }
  const chatToastTimerRef = useRef(null);

  // Game mode and opponent info (for dynamic labels)
  const [gameMode, setGameMode] = useState('ai'); // 'ai' or 'pvp'
  const [opponentName, setOpponentName] = useState('AI');

  // PvP pending: ships placed but waiting for opponent to place theirs
  const [isPvpWaiting, setIsPvpWaiting] = useState(false);
  const isPvpWaitingRef = useRef(false); // mirror readable inside stale WS closures
  isPvpWaitingRef.current = isPvpWaiting;

  // Refs used in unmount cleanup (stale-closure safe)
  const isPlacingShipsRef = useRef(true);
  isPlacingShipsRef.current = isPlacingShips;
  const gameIdRef = useRef(null);
  gameIdRef.current = gameId;

  // PvP placement countdown (seconds remaining for the other player to place ships)
  const [pvpPlacementSecondsLeft, setPvpPlacementSecondsLeft] = useState(null);
  const pvpPlacementTimerRef = useRef(null);

  // Opponent-disconnected notification with 60s reconnect countdown
  const [opponentDisconnectedNotice, setOpponentDisconnectedNotice] = useState(false);
  const [opponentReconnectCountdown, setOpponentReconnectCountdown] = useState(null);
  const disconnectTimerRef = useRef(null);

  // Navigation confirmation (leaving = forfeit during active game)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pendingLeaveAction, setPendingLeaveAction] = useState(null); // 'menu' or 'logout'

  // Stan dla WebSocket i gameplay
  const [isMyTurn, setIsMyTurn] = useState(false);
  const isMyTurnRef = useRef(false); // mirror of isMyTurn, readable inside stale WS closures
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const socketRef = useRef(null);

  // Keep isMyTurnRef in sync so WS handlers can read the current value
  isMyTurnRef.current = isMyTurn;

  // Lista dostępnych statków (długości) do rozmieszczenia.
  const allShips = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

  // Statki pozostałe do rozmieszczenia (nieużyte jeszcze)
  const remainingShips = allShips.filter((size, index) => {
    // Sprawdzamy ile statków danego rozmiaru już umieściliśmy
    const placedCount = placedShips.filter(s => s.size === size).length;
    // Zliczamy ile razy ten rozmiar występuje przed tym indeksem
    const beforeIndex = allShips.slice(0, index).filter(s => s === size).length;
    return beforeIndex >= placedCount;
  });

  // Funkcja odtwarzająca stan planszy z pozycji statków
  const loadShipsToBoard = (shipPositions) => {
    const newBoard = createEmptyBoard();
    const loadedShips = [];

    if (shipPositions && Array.isArray(shipPositions)) {
      // Zaznaczamy wszystkie pozycje na planszy
      shipPositions.forEach((pos) => {
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
          newBoard[pos.x][pos.y] = CELL_TYPES.SHIP;
        }
      });

      // Grupujemy pozycje według sąsiedztwa aby zidentyfikować poszczególne statki
      const visited = new Set();

      shipPositions.forEach((pos, index) => {
        if (!visited.has(index) && pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
          const shipGroup = [pos];
          visited.add(index);

          // Rekurencyjnie szukamy wszystkich sąsiadujących pozycji
          let changed = true;
          while (changed) {
            changed = false;
            shipPositions.forEach((otherPos, otherIndex) => {
              if (!visited.has(otherIndex) && otherPos && typeof otherPos.x === 'number' && typeof otherPos.y === 'number') {
                const isAdjacent = shipGroup.some(sp =>
                  (sp.x === otherPos.x && Math.abs(sp.y - otherPos.y) === 1) ||
                  (sp.y === otherPos.y && Math.abs(sp.x - otherPos.x) === 1)
                );

                if (isAdjacent) {
                  shipGroup.push(otherPos);
                  visited.add(otherIndex);
                  changed = true;
                }
              }
            });
          }

          if (shipGroup.length > 0) {
            loadedShips.push({
              size: shipGroup.length,
              positions: shipGroup
            });
          }
        }
      });
    }

    return { board: newBoard, ships: loadedShips };
  };

  // Restore game boards and shot history from shots array
  const restoreGameStateFromShots = (existingPlayerBoard, playerShots, opponentShots, playerInactiveAll = [], opponentInactiveAll = [], opponentLabel = 'AI') => {
    // Start with the existing player board (which has ships)
    const newPlayerBoard = existingPlayerBoard.map((r) => r.slice());
    const newEnemyBoard = createEmptyBoard();
    const newShotHistory = [];

    // Combine all shots with player identifier
    const allShots = [];
    if (opponentShots && Array.isArray(opponentShots)) {
      opponentShots.forEach(shot => {
        allShots.push({ ...shot, player: opponentLabel });
      });
    }
    if (playerShots && Array.isArray(playerShots)) {
      playerShots.forEach(shot => {
        allShots.push({ ...shot, player: 'You' });
      });
    }

    // Sort all shots chronologically by timestamp
    allShots.sort((a, b) => {
      const timeA = new Date(a.timestamp || 0).getTime();
      const timeB = new Date(b.timestamp || 0).getTime();
      return timeA - timeB;
    });

    // Process shots in chronological order
    allShots.forEach((shot) => {
      const { row, col, result, inactive, player } = shot;

      if (typeof row === 'number' && typeof col === 'number') {
        if (player !== 'You') {
          // Opponent shots go on player board
          if (newPlayerBoard[row][col] === CELL_TYPES.EMPTY) {
            newPlayerBoard[row][col] = result === 'hit' ? CELL_TYPES.HIT : CELL_TYPES.MISS;
          } else if (newPlayerBoard[row][col] === CELL_TYPES.SHIP) {
            // Opponent shot hit our ship
            newPlayerBoard[row][col] = CELL_TYPES.HIT;
          }

          // Apply inactive cells (boundaries around sunk ships) - these are always marked as MISS
          if (inactive && Array.isArray(inactive)) {
            inactive.forEach(({ row: inRow, col: inCol }) => {
              if (inRow >= 0 && inRow < BOARD_SIZE && inCol >= 0 && inCol < BOARD_SIZE) {
                // Mark inactive cells as MISS if they're empty
                if (newPlayerBoard[inRow][inCol] === CELL_TYPES.EMPTY || newPlayerBoard[inRow][inCol] === CELL_TYPES.SHIP) {
                  newPlayerBoard[inRow][inCol] = CELL_TYPES.MISS;
                }
              }
            });
          }
        } else {
          // Player shots go on enemy board
          newEnemyBoard[row][col] = result === 'hit' ? CELL_TYPES.HIT : CELL_TYPES.MISS;

          // Apply inactive cells (boundaries around sunk ships)
          if (inactive && Array.isArray(inactive)) {
            inactive.forEach(({ row: inRow, col: inCol }) => {
              if (inRow >= 0 && inRow < BOARD_SIZE && inCol >= 0 && inCol < BOARD_SIZE) {
                if (newEnemyBoard[inRow][inCol] === CELL_TYPES.EMPTY) {
                  newEnemyBoard[inRow][inCol] = CELL_TYPES.MISS;
                }
              }
            });
          }
        }

        // Add to shot history with proper sunk info
        newShotHistory.push({
          player,
          row,
          col,
          result,
          sunk: shot.sunk ? `Ship sunk (${shot.sunk_ship?.length || 0} cells)` : null
        });
      }
    });

    // Apply aggregate inactive cells:
    // playerInactiveAll = player_1_inactive = our inactive cells → apply to newPlayerBoard
    if (playerInactiveAll && Array.isArray(playerInactiveAll)) {
      playerInactiveAll.forEach(({ row, col }) => {
        if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
          if (newPlayerBoard[row][col] === CELL_TYPES.EMPTY || newPlayerBoard[row][col] === CELL_TYPES.SHIP) {
            newPlayerBoard[row][col] = CELL_TYPES.MISS;
          }
        }
      });
    }

    // opponentInactiveAll = player_2_inactive = opponent inactive cells → apply to newEnemyBoard
    if (opponentInactiveAll && Array.isArray(opponentInactiveAll)) {
      opponentInactiveAll.forEach(({ row, col }) => {
        if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
          if (newEnemyBoard[row][col] === CELL_TYPES.EMPTY) {
            newEnemyBoard[row][col] = CELL_TYPES.MISS;
          }
        }
      });
    }

    return { playerBoard: newPlayerBoard, enemyBoard: newEnemyBoard, shotHistory: newShotHistory };
  };

  // Tworzymy grę AI przy montowaniu komponentu
  useEffect(() => {
    const initializeGame = async () => {
      // Zapobiegaj wielokrotnemu wywoływaniu
      if (gameInitialized || initializingRef.current) {
        return;
      }

      try {
        initializingRef.current = true;
        setGameLoading(true);
        // Reset game state for new game
        setGameResult(null);
        setIsWaitingForResponse(false);
        setShotHistory([]);

        let currentGameId = null;
        try {
          const activeGameResponse = await axios.get(
            `${API_BASE_URL}/games/active/`,
            { withCredentials: true }
          );

          if (activeGameResponse.data && activeGameResponse.data.id) {
            const activeGame = activeGameResponse.data;
            const mode = activeGame.game_type || 'ai';

            // Issue 2 fix: when explicitly starting AI, skip any stale PvP active game
            if (location.state?.startAI && mode === 'pvp') {
              // Fall through to AI game creation below
              // The backend create endpoint also auto-clears pending PvP games
            } else {
              currentGameId = activeGameResponse.data.id;
              const isP1 = activeGame.player_1 === user.id?.toString() || activeGame.player_1 === user.id;

              // Set game mode & opponent name from active game metadata
              setGameMode(mode);
              const oppUsername = isP1 ? activeGame.player_2_username : activeGame.player_1_username;
              setOpponentName(mode === 'ai' ? 'AI' : (oppUsername || 'Opponent'));

              setGameId(currentGameId);
              setGameInitialized(true);

              try {
                const shipsStatusResponse = await axios.get(
                  `${API_BASE_URL}/games/${currentGameId}/ships_status/`,
                  { withCredentials: true }
                );

                const myShipsReady = isP1 ? shipsStatusResponse.data.player_1_ready : shipsStatusResponse.data.player_2_ready;
                const myShipsData = isP1 ? shipsStatusResponse.data.player_1_ships : shipsStatusResponse.data.player_2_ships;
                const opponentKey = isP1 ? 'player_2_ready' : 'player_1_ready';
                const opponentShipsReady = shipsStatusResponse.data[opponentKey];

                if (myShipsReady && myShipsData) {
                  const shipData = myShipsData;
                  const { board, ships } = loadShipsToBoard(shipData.positions);

                  setPlacedShips(ships);
                  setIsPlacingShips(false);
                  setIsMyTurn(false);
                  setIsWaitingForResponse(false);

                  // For PvP: if opponent hasn't placed ships yet, enter waiting state
                  if (mode === 'pvp' && !opponentShipsReady) {
                    setPlayerBoard(board);
                    setIsPvpWaiting(true);
                    setStatusMessage('Waiting for opponent to place their ships...');
                    localStorage.removeItem(`game_${currentGameId}_ships`);
                    gameSocket.connect(currentGameId);
                  } else {
                    setStatusMessage('Ships already placed. Waiting for opponent...');

                    // Fetch shots to restore game progress
                    try {
                      const shotsResponse = await axios.get(
                        `${API_BASE_URL}/games/${currentGameId}/shots/`,
                        { withCredentials: true }
                      );
                      const { player_1_shots, player_2_shots, player_1_inactive, player_2_inactive, current_turn, chat_messages } = shotsResponse.data;

                      const myShots = isP1 ? player_1_shots : player_2_shots;
                      const enemyShots = isP1 ? player_2_shots : player_1_shots;
                      const myInactive = isP1 ? player_1_inactive : player_2_inactive;
                      const enemyInactive = isP1 ? player_2_inactive : player_1_inactive;

                      const oppLabel = mode === 'ai' ? 'AI' : (oppUsername || 'Opponent');
                      const restored = restoreGameStateFromShots(board, myShots, enemyShots, myInactive, enemyInactive, oppLabel);
                      setPlayerBoard(restored.playerBoard);
                      setEnemyBoard(restored.enemyBoard);
                      setShotHistory(restored.shotHistory);

                      if (chat_messages) {
                        const loadedMessages = chat_messages.map(msg => ({
                          senderId: msg.sender_id,
                          senderUsername: msg.sender_username,
                          message: msg.message,
                          timestamp: msg.timestamp,
                          isMe: msg.sender_id === user.id?.toString(),
                        }));
                        setChatMessages(loadedMessages);
                      }

                      // Set whose turn it is
                      if (current_turn) {
                        setIsMyTurn(current_turn === user.id.toString());
                        setStatusMessage(current_turn === user.id.toString() ? 'Your turn - shoot on enemy board.' : `Waiting for ${oppLabel}'s move...`);
                      }
                    } catch (shotsErr) {
                      console.error('Failed to restore shots:', shotsErr);
                      setPlayerBoard(board);
                    }

                    localStorage.removeItem(`game_${currentGameId}_ships`);
                    gameSocket.connect(currentGameId);
                  }
                } else {
                  // I haven't placed ships yet
                  const timerRemaining = shipsStatusResponse.data.placement_timer_remaining;
                  if (mode === 'pvp' && opponentShipsReady && timerRemaining != null && timerRemaining > 0) {
                    // Opponent already placed — start the visible countdown from REST data (no WS needed yet)
                    if (pvpPlacementTimerRef.current) clearInterval(pvpPlacementTimerRef.current);
                    let secs = timerRemaining;
                    setPvpPlacementSecondsLeft(secs);
                    pvpPlacementTimerRef.current = setInterval(() => {
                      secs -= 1;
                      if (secs <= 0) {
                        clearInterval(pvpPlacementTimerRef.current);
                        pvpPlacementTimerRef.current = null;
                        setPvpPlacementSecondsLeft(0);
                      } else {
                        setPvpPlacementSecondsLeft(secs);
                      }
                    }, 1000);
                  }

                  const savedState = localStorage.getItem(`game_${currentGameId}_ships`);
                  if (savedState) {
                    try {
                      const { board, ships } = JSON.parse(savedState);
                      const restoredBoard = createEmptyBoard();
                      board.forEach((row, rowIdx) => {
                        row.forEach((cell, colIdx) => {
                          restoredBoard[rowIdx][colIdx] = cell;
                        });
                      });

                      setPlayerBoard(restoredBoard);
                      setPlacedShips(ships);
                      setStatusMessage(`Continuing ship placement. ${ships.length}/${allShips.length} ships placed.`);
                    } catch (err) {
                      setStatusMessage('Continuing existing game. Place your ships on your board.');
                    }
                  } else {
                    setStatusMessage('Place your ships on your board.');
                  }
                  // For AI: join the WS game group now so leave_game reaches the server on unmount
                  if (mode === 'ai') gameSocket.connect(currentGameId);
                }
              } catch (statusErr) {
                setStatusMessage('Place your ships on your board.');
              }

              setError(null);
              setGameLoading(false);
              return;
            } // end of else (not skipping PvP)
          }
        } catch (activeErr) {
          if (activeErr.response?.status !== 404) {
            throw activeErr;
          }
        }

        // If no active game was found and we weren't instructed to start AI, redirect properly.
        if (!location.state?.startAI) {
          setStatusMessage("Active game not found! It might have timed out. Redirecting to menu...");
          setGameLoading(false);
          setTimeout(() => navigate('/menu'), 3000);
          return;
        }

        let newGameId = null;
        try {
          setIsCreatingGame(true);
          const response = await axios.post(
            `${API_BASE_URL}/games/`,
            { game_type: 'ai' },
            { withCredentials: true }
          );
          newGameId = response.data.id;
          setGameId(newGameId);
          setGameInitialized(true);
        } catch (createErr) {
          if (createErr.response?.status === 409) {
            const activeGameResponse = await axios.get(
              `${API_BASE_URL}/games/active/`,
              { withCredentials: true }
            );

            if (activeGameResponse.data && activeGameResponse.data.id) {
              const existingGameId = activeGameResponse.data.id;
              const activeGame = activeGameResponse.data;
              const isP1 = activeGame.player_1 === user.id?.toString() || activeGame.player_1 === user.id;

              // Set game mode & opponent name from active game metadata
              const mode = activeGame.game_type || 'ai';
              setGameMode(mode);
              const oppUsername = isP1 ? activeGame.player_2_username : activeGame.player_1_username;
              setOpponentName(mode === 'ai' ? 'AI' : (oppUsername || 'Opponent'));

              setGameId(existingGameId);
              setGameInitialized(true);

              try {
                const shipsStatusResponse = await axios.get(
                  `${API_BASE_URL}/games/${existingGameId}/ships_status/`,
                  { withCredentials: true }
                );

                const myShipsReady = isP1 ? shipsStatusResponse.data.player_1_ready : shipsStatusResponse.data.player_2_ready;
                const myShipsData = isP1 ? shipsStatusResponse.data.player_1_ships : shipsStatusResponse.data.player_2_ships;
                const opponentShipsReady = isP1 ? shipsStatusResponse.data.player_2_ready : shipsStatusResponse.data.player_1_ready;

                if (myShipsReady && myShipsData) {
                  const shipData = myShipsData;
                  const { board, ships } = loadShipsToBoard(shipData.positions);

                  setPlacedShips(ships);
                  setIsPlacingShips(false);
                  setIsMyTurn(false);
                  setIsWaitingForResponse(false);

                  // PvP pending: I placed ships but opponent hasn't yet → waiting state
                  if (mode === 'pvp' && !opponentShipsReady) {
                    setPlayerBoard(board);
                    setIsPvpWaiting(true);
                    setStatusMessage('Waiting for opponent to place their ships...');
                    localStorage.removeItem(`game_${existingGameId}_ships`);
                    gameSocket.connect(existingGameId);
                  } else {
                    setStatusMessage('Ships already placed. Waiting for opponent...');

                    // Fetch shots to restore game progress
                    try {
                      const shotsResponse = await axios.get(
                        `${API_BASE_URL}/games/${existingGameId}/shots/`,
                        { withCredentials: true }
                      );
                      const { player_1_shots, player_2_shots, player_1_inactive, player_2_inactive, current_turn, chat_messages } = shotsResponse.data;

                      const myShots = isP1 ? player_1_shots : player_2_shots;
                      const enemyShots = isP1 ? player_2_shots : player_1_shots;
                      const myInactive = isP1 ? player_1_inactive : player_2_inactive;
                      const enemyInactive = isP1 ? player_2_inactive : player_1_inactive;

                      const oppLabel2 = mode === 'ai' ? 'AI' : (oppUsername || 'Opponent');
                      const restored = restoreGameStateFromShots(board, myShots, enemyShots, myInactive, enemyInactive, oppLabel2);
                      setPlayerBoard(restored.playerBoard);
                      setEnemyBoard(restored.enemyBoard);
                      setShotHistory(restored.shotHistory);

                      if (chat_messages) {
                        const loadedMessages = chat_messages.map(msg => ({
                          senderId: msg.sender_id,
                          senderUsername: msg.sender_username,
                          message: msg.message,
                          timestamp: msg.timestamp,
                          isMe: msg.sender_id === user.id?.toString(),
                        }));
                        setChatMessages(loadedMessages);
                      }

                      // Set whose turn it is
                      if (current_turn) {
                        setIsMyTurn(current_turn === user.id.toString());
                        setStatusMessage(current_turn === user.id.toString() ? 'Your turn - shoot on enemy board.' : `Waiting for ${oppLabel2}'s move...`);
                      }
                    } catch (shotsErr) {
                      // If we can't fetch shots, just use the ship board
                      console.error('Failed to restore shots:', shotsErr);
                      setPlayerBoard(board);
                    }

                    localStorage.removeItem(`game_${existingGameId}_ships`);

                    // Connect to WebSocket when loading existing in-progress game
                    gameSocket.connect(existingGameId);
                  } // end else (not pvpWaiting)
                } else {
                  // I haven't placed ships yet
                  const timerRemaining = shipsStatusResponse.data.placement_timer_remaining;
                  if (mode === 'pvp' && opponentShipsReady && timerRemaining != null && timerRemaining > 0) {
                    // Opponent already placed — start the visible countdown from REST data (no WS needed yet)
                    if (pvpPlacementTimerRef.current) clearInterval(pvpPlacementTimerRef.current);
                    let secs = timerRemaining;
                    setPvpPlacementSecondsLeft(secs);
                    pvpPlacementTimerRef.current = setInterval(() => {
                      secs -= 1;
                      if (secs <= 0) {
                        clearInterval(pvpPlacementTimerRef.current);
                        pvpPlacementTimerRef.current = null;
                        setPvpPlacementSecondsLeft(0);
                      } else {
                        setPvpPlacementSecondsLeft(secs);
                      }
                    }, 1000);
                  }

                  const savedState = localStorage.getItem(`game_${existingGameId}_ships`);
                  if (savedState) {
                    try {
                      const { board, ships } = JSON.parse(savedState);
                      const restoredBoard = createEmptyBoard();
                      board.forEach((row, rowIdx) => {
                        row.forEach((cell, colIdx) => {
                          restoredBoard[rowIdx][colIdx] = cell;
                        });
                      });
                      setPlayerBoard(restoredBoard);
                      setPlacedShips(ships);
                      setStatusMessage(`Continuing ship placement. ${ships.length}/${allShips.length} ships placed.`);
                    } catch (err) {
                      setStatusMessage('Continuing existing game. Place your ships on your board.');
                    }
                  } else {
                    setStatusMessage('Place your ships on your board.');
                  }
                  // For AI: join the WS game group now so leave_game reaches the server on unmount
                  if (mode === 'ai') gameSocket.connect(existingGameId);
                }
              } catch (statusErr) {
                setStatusMessage('Place your ships on your board.');
              }

              setError(null);
              setGameLoading(false);
              setIsCreatingGame(false);
              return;
            }
          }

          setIsCreatingGame(false);
          throw createErr;
        }
        setIsCreatingGame(false);

        // Join the WS game group during placement so the leave_game cleanup message
        // reaches the server when the player navigates away before placing ships.
        gameSocket.connect(newGameId);

        const savedState = localStorage.getItem(`game_${newGameId}_ships`);
        if (savedState) {
          try {
            const { board, ships } = JSON.parse(savedState);
            const restoredBoard = createEmptyBoard();
            board.forEach((row, rowIdx) => {
              row.forEach((cell, colIdx) => {
                restoredBoard[rowIdx][colIdx] = cell;
              });
            });
            setPlayerBoard(restoredBoard);
            setPlacedShips(ships);
            setStatusMessage(`Continuing ship placement. ${ships.length}/${allShips.length} ships placed.`);
          } catch (err) {
            setStatusMessage('Game created! Place your ships on your board.');
          }
        } else {
          setStatusMessage('Game created! Place your ships on your board.');
        }

        setError(null);
      } catch (err) {
        const errorMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to initialize game';
        setError(errorMsg);
        setStatusMessage('Error initializing game. Please try again.');
      } finally {
        setGameLoading(false);
        setIsCreatingGame(false);
        initializingRef.current = false;
      }
    };

    if (user) {
      initializeGame();
    }
  }, [user]);

  useEffect(() => {
    let timerId;
    if (gameLoading) {
      timerId = setTimeout(() => {
        setShowLoadingBanner(true);
      }, 200);
    } else {
      setShowLoadingBanner(false);
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [gameLoading]);

  useEffect(() => {
    if (gameResult !== 'lose' && gameResult !== 'win') return;

    if (redirectCountdown <= 0) {
      navigate('/menu');
      return;
    }

    const timer = setTimeout(() => {
      setRedirectCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [redirectCountdown, gameResult, navigate]);

  // Setup WebSocket handlers for game communication
  useEffect(() => {
    // Only setup WebSocket if game has started (not placing ships)
    if (isPlacingShips || !gameId) return;

    const placementTimerStartHandler = (data) => {
      if (pvpPlacementTimerRef.current) return; // already counting down from REST response
      let secs = data.seconds ?? 60;
      setPvpPlacementSecondsLeft(secs);
      pvpPlacementTimerRef.current = setInterval(() => {
        secs -= 1;
        if (secs <= 0) {
          clearInterval(pvpPlacementTimerRef.current);
          pvpPlacementTimerRef.current = null;
          setPvpPlacementSecondsLeft(0);
        } else {
          setPvpPlacementSecondsLeft(secs);
        }
      }, 1000);
    };

    const gameCancelledHandler = (data) => {
      if (pvpPlacementTimerRef.current) { clearInterval(pvpPlacementTimerRef.current); pvpPlacementTimerRef.current = null; }
      setPvpPlacementSecondsLeft(null);
      setIsPvpWaiting(false);
      let msg;
      if (data.reason === 'placement_timeout') {
        msg = `${opponentName} ran out of time to place their ships. Game cancelled. Returning to menu...`;
      } else if (data.reason === 'player_left') {
        msg = `${opponentName} left the game. Game cancelled. Returning to menu...`;
      } else {
        msg = 'Game cancelled. Returning to menu...';
      }
      setStatusMessage(msg);
      setTimeout(() => navigate('/menu'), 3000);
    };

    const setupSocketHandlers = () => {
      // Handle game move responses (opponent's shot result or our shot result)
      gameSocket.on('game_move', (data) => {
        if (data.move_type === 'shot') {
          const { row, col, result, sunk, sunk_ship: sunkShip, inactive } = data.data; // result: 'hit' or 'miss'

          if (data.player_id === user.id) {
            // Our shot result came back
            setIsWaitingForResponse(false);

            // Clear any pending timeout
            if (window.shotTimeoutId) {
              clearTimeout(window.shotTimeoutId);
              window.shotTimeoutId = null;
            }

            // Use functional setState to avoid stale closure when multiple messages arrive quickly
            setEnemyBoard(prev => {
              const newEnemyBoard = prev.map((r) => r.slice());
              newEnemyBoard[row][col] = result === 'hit' ? CELL_TYPES.HIT : CELL_TYPES.MISS;
              return applyInactiveCells(newEnemyBoard, inactive);
            });

            // Add to shot history
            setShotHistory(prev => [...prev, {
              player: 'You',
              row,
              col,
              result,
              sunk: sunk ? `Ship sunk (${sunkShip?.length || 0} cells)` : null
            }]);

            if (sunk && sunkShip?.length) {
              setStatusMessage('🚢 Ship sunk! Shoot again.');
            } else {
              setStatusMessage(result === 'hit' ? '🎯 Hit! Shoot again.' : `💧 Miss! ${opponentName} is shooting...`);
            }

            // If hit, we keep turn
            setIsMyTurn(result === 'hit');
          } else {
            // Opponent (AI) shot at us
            const hitResult = result === 'hit' ? 'hit' : 'miss';

            // Add to shot history
            setShotHistory(prev => [...prev, {
              player: opponentName,
              row,
              col,
              result: hitResult,
              sunk: sunk ? `Ship sunk (${sunkShip?.length || 0} cells)` : null
            }]);

            setPlayerBoard(prevBoard => {
              const newPlayerBoard = prevBoard.map((r) => r.slice());
              newPlayerBoard[row][col] = hitResult === 'hit' ? CELL_TYPES.HIT : CELL_TYPES.MISS;

              // If ship was sunk, explicitly mark all sunk ship cells as HIT
              if (sunk && sunkShip?.length) {
                sunkShip.forEach(({ row: sunkRow, col: sunkCol }) => {
                  newPlayerBoard[sunkRow][sunkCol] = CELL_TYPES.HIT;
                });
              }

              return applyInactiveCells(newPlayerBoard, inactive);
            });

            if (sunk && sunkShip?.length) {
              setStatusMessage(`${opponentName} sunk a ship at ${formatBoardCoordinate(row, col)}. They shoot again...`);
            } else {
              setStatusMessage(`${opponentName} shot at ${formatBoardCoordinate(row, col)}. ${hitResult === 'hit' ? '🎯 They hit! They shoot again...' : '💧 They missed!'}`);
            }

            // If AI missed, it's our turn
            setIsMyTurn(hitResult === 'miss');
          }
        }
      });

      // Handle game ended
      gameSocket.on('game_ended', (data) => {
        setOpponentDisconnectedNotice(false);
        setOpponentReconnectCountdown(null);
        if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null; }
        setIsPvpWaiting(false);

        if (data.reason === 'both_disconnected') {
          setGameResult('lose');
          setStatusMessage('Both players disconnected. Game cancelled.');
        } else if (data.winner_id === user.id) {
          setGameResult('win');
          setStatusMessage('🎉 You won!');
        } else {
          setGameResult('lose');
          setStatusMessage('💀 You lost!');
        }
      });

      // Handle game forfeit
      gameSocket.on('game_forfeit', (data) => {
        setOpponentDisconnectedNotice(false);
        setOpponentReconnectCountdown(null);
        if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null; }
        setIsPvpWaiting(false);
        setGameResult(data.player_id === user.id ? 'lose' : 'win');
        setStatusMessage(data.player_id === user.id ? 'You forfeited.' : 'Opponent forfeited. You won!');
      });

      // Handle connected — just a WS handshake confirmation; game start is via game_start event
      gameSocket.on('connected', (data) => {
        // For AI games the connect() onConnect callback handles isMyTurn
        // For PvP games, game_start event handles isMyTurn
      });

      // Handle player joined — clear disconnect notice if opponent reconnected
      gameSocket.on('player_joined', (data) => {
        if (data.player_id !== user.id?.toString()) {
          if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null; }
          setOpponentDisconnectedNotice(false);
          setOpponentReconnectCountdown(null);
          // Restore the correct status message
          if (isPvpWaitingRef.current) {
            setStatusMessage('Waiting for opponent to place their ships...');
          } else {
            setStatusMessage(isMyTurnRef.current
              ? 'Your turn - shoot on enemy board.'
              : `Waiting for ${opponentName}'s move...`);
          }
        }
      });

      // Handle chat messages
      gameSocket.on('chat_message', (data) => {
        const msg = {
          senderId: data.sender_id,
          senderUsername: data.sender_username,
          message: data.message,
          timestamp: data.timestamp,
          isMe: data.sender_id === user.id?.toString(),
        };
        setChatMessages(prev => [...prev, msg]);
        // Show toast for opponent messages
        if (data.sender_id !== user.id?.toString()) {
          if (chatToastTimerRef.current) clearTimeout(chatToastTimerRef.current);
          setChatToast({ message: data.message, senderUsername: data.sender_username });
          chatToastTimerRef.current = setTimeout(() => {
            setChatToast(null);
            chatToastTimerRef.current = null;
          }, 4000);
        }
      });

      // Handle opponent disconnected — 60s grace period before forfeit
      gameSocket.on('opponent_disconnected', (data) => {
        if (data.disconnected_player_id !== user.id?.toString()) {
          setOpponentDisconnectedNotice(true);
          if (disconnectTimerRef.current) clearInterval(disconnectTimerRef.current);
          let secs = data.reconnect_timeout_seconds ?? 60;
          setOpponentReconnectCountdown(secs);
          disconnectTimerRef.current = setInterval(() => {
            secs -= 1;
            if (secs <= 0) {
              clearInterval(disconnectTimerRef.current);
              disconnectTimerRef.current = null;
              setOpponentReconnectCountdown(0);
            } else {
              setOpponentReconnectCountdown(secs);
            }
          }, 1000);
          setStatusMessage(`${opponentName} disconnected. They have 60s to reconnect...`);
        }
      });

      // Handle game_start: both players placed ships, game is now active
      gameSocket.on('game_start', (data) => {
        if (pvpPlacementTimerRef.current) { clearInterval(pvpPlacementTimerRef.current); pvpPlacementTimerRef.current = null; }
        setPvpPlacementSecondsLeft(null);
        setIsPvpWaiting(false);
        const iAmFirst = data.starting_player_id === user.id?.toString();
        setIsMyTurn(iAmFirst);
        setStatusMessage(iAmFirst ? 'Game started! Your turn — shoot on enemy board.' : `Game started! Waiting for ${opponentName}'s move...`);
      });

      // Handle placement_timer_start: start a visible countdown for both players
      // Guard: skip if timer already running (player 1 may have started it from REST response)
      gameSocket.on('placement_timer_start', placementTimerStartHandler);

      // Handle game_cancelled: placement timeout or player left
      // This fires for Player 1 (isPvpWaiting=true, isPlacingShips=false)
      gameSocket.on('game_cancelled', gameCancelledHandler);
    };

    setupSocketHandlers();
    socketRef.current = gameSocket;

    // Cleanup on unmount
    return () => {
      gameSocket.off('game_move');
      gameSocket.off('game_ended');
      gameSocket.off('game_forfeit');
      gameSocket.off('connected');
      gameSocket.off('player_joined');
      gameSocket.off('chat_message');
      gameSocket.off('opponent_disconnected');
      gameSocket.off('game_start');
      gameSocket.off('placement_timer_start', placementTimerStartHandler);
      gameSocket.off('game_cancelled', gameCancelledHandler);
      if (pvpPlacementTimerRef.current) { clearInterval(pvpPlacementTimerRef.current); pvpPlacementTimerRef.current = null; }
      if (disconnectTimerRef.current) { clearInterval(disconnectTimerRef.current); disconnectTimerRef.current = null; }
      if (chatToastTimerRef.current) { clearTimeout(chatToastTimerRef.current); chatToastTimerRef.current = null; }
    };
  }, [isPlacingShips, gameId, user.id, opponentName]);

  // Early WS connection during PvP ship placement so player 2 (and player 1 before they finish)
  // can receive placement_timer_start and game_cancelled events before ships are placed.
  useEffect(() => {
    if (!isPlacingShips || gameMode !== 'pvp' || !gameId) return;

    gameSocket.connect(gameId);

    const placementTimerStartHandler = (data) => {
      if (pvpPlacementTimerRef.current) clearInterval(pvpPlacementTimerRef.current);
      let secs = data.seconds ?? 60;
      setPvpPlacementSecondsLeft(secs);
      pvpPlacementTimerRef.current = setInterval(() => {
        secs -= 1;
        if (secs <= 0) {
          clearInterval(pvpPlacementTimerRef.current);
          pvpPlacementTimerRef.current = null;
          setPvpPlacementSecondsLeft(0);
        } else {
          setPvpPlacementSecondsLeft(secs);
        }
      }, 1000);
    };

    const gameCancelledHandler = (data) => {
      if (pvpPlacementTimerRef.current) { clearInterval(pvpPlacementTimerRef.current); pvpPlacementTimerRef.current = null; }
      setPvpPlacementSecondsLeft(null);
      // This fires for Player 2 who is still placing ships — determine reason
      let msg;
      if (data.reason === 'player_left') {
        msg = 'Your opponent left the game. Game cancelled. Returning to menu...';
      } else if (data.reason === 'placement_timeout') {
        msg = "Time's up! You didn't finish placing ships in time. Game cancelled. Returning to menu...";
      } else {
        msg = 'Game cancelled. Returning to menu...';
      }
      setStatusMessage(msg);
      setTimeout(() => navigate('/menu'), 3000);
    };

    gameSocket.on('placement_timer_start', placementTimerStartHandler);
    gameSocket.on('game_cancelled', gameCancelledHandler);

    return () => {
      gameSocket.off('placement_timer_start', placementTimerStartHandler);
      gameSocket.off('game_cancelled', gameCancelledHandler);
    };
  }, [gameId, gameMode, isPlacingShips]);

  // Scroll chat box to bottom when new messages arrive (no page scroll)
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Countdown hit 0 while player is still placing ships — they ran out of time.
  // (Fallback for when game_cancelled WS event hasn't arrived yet.)
  useEffect(() => {
    if (pvpPlacementSecondsLeft === 0 && isPlacingShips) {
      if (pvpPlacementTimerRef.current) { clearInterval(pvpPlacementTimerRef.current); pvpPlacementTimerRef.current = null; }
      setStatusMessage("Time's up! You didn't finish placing ships in time. Returning to menu...");
      setTimeout(() => navigate('/menu'), 3000);
    }
  }, [pvpPlacementSecondsLeft, isPlacingShips, navigate]);

  // Countdown hit 0 while Player 1 is in waiting state — opponent ran out of time.
  // (Fallback for when game_cancelled WS event hasn't arrived yet.)
  useEffect(() => {
    if (pvpPlacementSecondsLeft === 0 && isPvpWaiting) {
      if (pvpPlacementTimerRef.current) { clearInterval(pvpPlacementTimerRef.current); pvpPlacementTimerRef.current = null; }
      setPvpPlacementSecondsLeft(null);
      setIsPvpWaiting(false);
      setStatusMessage(`${opponentName} ran out of time to place their ships. Game cancelled. Returning to menu...`);
      setTimeout(() => navigate('/menu'), 3000);
    }
  }, [pvpPlacementSecondsLeft, isPvpWaiting, opponentName, navigate]);

  // beforeunload handler - warn when closing/refreshing tab during active game (not during pending/waiting)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isPlacingShips && !isPvpWaiting && gameResult === null && gameId) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isPlacingShips, isPvpWaiting, gameResult, gameId]);

  // Sync game active state to GameContext (used by LogoutButton)
  useEffect(() => {
    const isActive = !isPlacingShips && !isPvpWaiting && gameResult === null && gameId;
    if (isActive) {
      setActiveGame(gameId);
      setOnForfeitAndLeave(() => async () => {
        try {
          gameSocket.sendForfeit();
          await axios.post(
            `${API_BASE_URL}/games/${gameId}/forfeit/`,
            {},
            { withCredentials: true }
          );
          localStorage.removeItem(`game_${gameId}_ships`);
        } catch (err) { }
      });
    } else {
      clearActiveGame();
    }
  }, [isPlacingShips, isPvpWaiting, gameResult, gameId, setActiveGame, clearActiveGame, setOnForfeitAndLeave]);

  // Clear GameContext on unmount; notify backend of leave so
  // the player's Redis state is handled (active game cancelled or disconnected)
  useEffect(() => {
    return () => {
      // isPlacingShipsRef / isPvpWaitingRef / gameIdRef are kept up-to-date
      // via direct assignment above — safe to read here even in stale closures.
      if (gameIdRef.current) {
        // Tell the server to handle the leave. The WS singleton stays
        // open across navigation, so this message will reach the server even
        // though the component is unmounting.
        gameSocket.send({ type: 'leave_game' });
      }
      clearActiveGame();
    };
  }, [clearActiveGame]);

  // Funkcja sprawdzająca, czy statek może zostać ustawiony w danym miejscu.
  const canPlaceShip = (board, row, col, size, dir) => {
    const cellsToCheck = [];

    // Zbieramy wszystkie pozycje statku
    if (dir === 'horizontal') {
      // Sprawdzamy czy statek nie wyjdzie poza planszę.
      if (col + size > BOARD_SIZE) return false;
      // Iterujemy po długości statku.
      for (let c = col; c < col + size; c += 1) {
        cellsToCheck.push({ r: row, c });
      }
    } else {
      // Dla orientacji pionowej sprawdzamy granice planszy.
      if (row + size > BOARD_SIZE) return false;
      // Iterujemy po długości statku w dół.
      for (let r = row; r < row + size; r += 1) {
        cellsToCheck.push({ r, c: col });
      }
    }

    // Sprawdzamy każdą komórkę statku i jej sąsiadów
    for (const cell of cellsToCheck) {
      // Jeśli pole nie jest puste, nie możemy postawić statku.
      if (board[cell.r][cell.c] !== CELL_TYPES.EMPTY) return false;

      // Sprawdzamy sąsiednie pola (góra, dół, lewo, prawo, przekątne)
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue; // pomijamy samą komórkę

          const newR = cell.r + dr;
          const newC = cell.c + dc;

          // Sprawdzamy czy sąsiad jest w granicach planszy
          if (newR >= 0 && newR < BOARD_SIZE && newC >= 0 && newC < BOARD_SIZE) {
            // Sprawdzamy czy sąsiad jest częścią tego samego statku
            const isPartOfCurrentShip = cellsToCheck.some(c => c.r === newR && c.c === newC);

            // Jeśli sąsiad nie jest częścią tego statku i ma statek, blokujemy
            if (!isPartOfCurrentShip && board[newR][newC] === CELL_TYPES.SHIP) {
              return false;
            }
          }
        }
      }
    }

    // Jeśli wszystkie warunki spełnione, zwracamy true.
    return true;
  };

  const isShipSizeAvailable = (ships, shipSize) => {
    const totalCount = allShips.filter((size) => size === shipSize).length;
    const placedCount = ships.filter((ship) => ship.size === shipSize).length;
    return placedCount < totalCount;
  };

  const applyInactiveCells = (board, inactive) => {
    if (!inactive || inactive.length === 0) return board;
    const nextBoard = board.map((r) => r.slice());
    inactive.forEach(({ row, col }) => {
      if (nextBoard[row] && nextBoard[row][col] === CELL_TYPES.EMPTY) {
        nextBoard[row][col] = CELL_TYPES.MISS;
      }
    });
    return nextBoard;
  };

  const formatBoardCoordinate = (row, col) => `${row + 1}${String.fromCharCode(65 + col)}`;

  const applyShipPlacement = (row, col, shipSize, baseBoard, baseShips, direction) => {
    const newBoard = baseBoard.map((r) => r.slice());
    const placementDir = direction || orientation;
    const allowed = canPlaceShip(newBoard, row, col, shipSize, placementDir);
    if (!allowed) {
      setStatusMessage('Cannot place ship here.');
      return false;
    }

    const shipPositions = [];

    if (placementDir === 'horizontal') {
      for (let c = col; c < col + shipSize; c += 1) {
        newBoard[row][c] = CELL_TYPES.SHIP;
        shipPositions.push({ x: row, y: c });
      }
    } else {
      for (let r = row; r < row + shipSize; r += 1) {
        newBoard[r][col] = CELL_TYPES.SHIP;
        shipPositions.push({ x: r, y: col });
      }
    }
    setPlayerBoard(newBoard);

    const newPlacedShips = [...baseShips, {
      size: shipSize,
      positions: shipPositions
    }];
    setPlacedShips(newPlacedShips);

    if (gameId) {
      localStorage.setItem(`game_${gameId}_ships`, JSON.stringify({
        board: newBoard,
        ships: newPlacedShips
      }));
    }

    const shipsLeft = allShips.length - newPlacedShips.length;
    if (shipsLeft > 0) {
      setStatusMessage(`Ship of size ${shipSize} placed. ${shipsLeft} ships remaining.`);
    } else {
      setStatusMessage('All ships placed! Click "Start Game" to begin.');
    }
    return true;
  };

  // Place a new ship from the sidebar (checking available sizes)
  const placeNewShip = (row, col, shipSize) => {
    if (!isShipSizeAvailable(placedShips, shipSize)) {
      setStatusMessage(`No more ships of size ${shipSize} available.`);
      return false;
    }
    return applyShipPlacement(row, col, shipSize, playerBoard, placedShips, orientation);
  };

  const getBoardCellFromPoint = (clientX, clientY) => {
    const target = document.elementFromPoint(clientX, clientY);
    const cell = target?.closest?.('[data-player-cell="true"]');
    if (!cell) return null;

    const row = Number(cell.getAttribute('data-row'));
    const col = Number(cell.getAttribute('data-col'));
    if (Number.isNaN(row) || Number.isNaN(col)) return null;
    return { row, col };
  };

  const tryDropDraggedShip = (row, col) => {
    const currentDraggedShip = draggedShipRef.current;
    if (!currentDraggedShip || !isPlacingShips) return false;

    let success = false;
    if (dragRestore) {
      const base = dragBaseRef.current;
      const dragDir = currentDraggedShip.orientation || orientation;
      success = applyShipPlacement(row, col, currentDraggedShip.size, base.board, base.ships, dragDir);
    } else {
      success = placeNewShip(row, col, currentDraggedShip.size);
    }

    if (success) {
      setDidDrop(true);
      didDropRef.current = true;
    }
    return success;
  };

  const handleShipTouchStart = (shipSize, e) => {
    if (!isPlacingShips) return;
    const touch = e.touches?.[0];
    if (!touch) return;

    setIsTouchGestureActive(true);

    touchGestureRef.current = {
      type: 'palette',
      shipSize,
      startX: touch.clientX,
      startY: touch.clientY,
      dragStarted: false,
    };
  };
  // Funkcje obsługi drag and drop
  const handleDragStart = (shipSize, e) => {
    const shipData = { size: shipSize, orientation: orientation };
    setDraggedShip(shipData);
    draggedShipRef.current = shipData;
    setDidDrop(false);
    didDropRef.current = false;

    // Create custom drag image based on orientation
    if (e && e.dataTransfer) {
      const dragImage = document.createElement('div');
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.style.display = 'flex';
      dragImage.style.flexDirection = orientation === 'vertical' ? 'column' : 'row';
      dragImage.style.gap = '2px';

      for (let i = 0; i < shipSize; i++) {
        const block = document.createElement('div');
        block.style.width = '16px';
        block.style.height = '16px';
        block.style.backgroundColor = '#10b981';
        block.style.border = '1px solid #047857';
        dragImage.appendChild(block);
      }

      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 8, 8);

      // Clean up after drag starts
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  };

  const handleDragEnd = () => {
    if (dragRestore && !didDropRef.current) {
      setPlayerBoard(dragRestore.board);
      setPlacedShips(dragRestore.ships);
      if (gameId) {
        localStorage.setItem(`game_${gameId}_ships`, JSON.stringify({
          board: dragRestore.board,
          ships: dragRestore.ships
        }));
      }
    }
    setDragRestore(null);
    dragBaseRef.current = null;
    setDraggedShip(null);
    draggedShipRef.current = null;
    setHoverCell(null);
    setDidDrop(false);
    didDropRef.current = false;
  };

  // Przy odmontowaniu komponentu przywracamy stan planszy,
  // jeśli trwało przeciąganie i nie zakończyło się poprawnym upuszczeniem.
  useEffect(() => {
    return () => {
      if (dragRestore && !didDropRef.current) {
        setPlayerBoard(dragRestore.board);
        setPlacedShips(dragRestore.ships);
        if (gameId) {
          localStorage.setItem(`game_${gameId}_ships`, JSON.stringify({
            board: dragRestore.board,
            ships: dragRestore.ships
          }));
        }
      }
      // Wyczyść stan przeciągania przy odmontowaniu.
      setDragRestore(null);
      dragBaseRef.current = null;
      setDraggedShip(null);
      draggedShipRef.current = null;
      setHoverCell(null);
      setDidDrop(false);
      didDropRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on component unmount
  const handleDragOver = (e, row, col) => {
    e.preventDefault();
    const currentDraggedShip = draggedShipRef.current;
    if (!isPlacingShips || !currentDraggedShip) {
      return;
    }
    setHoverCell({ row, col });
  };

  const handleDragLeave = () => {
    setHoverCell(null);
  };

  const handleDrop = (e, row, col) => {
    e.preventDefault();
    tryDropDraggedShip(row, col);
    setDraggedShip(null);
    draggedShipRef.current = null;
    setHoverCell(null);
  };

  const handleTouchMove = (e) => {
    if (!isPlacingShips) return;
    const gesture = touchGestureRef.current;
    if (!gesture) return;

    const touch = e.touches?.[0];
    if (!touch) return;

    const movedEnough = Math.hypot(
      touch.clientX - gesture.startX,
      touch.clientY - gesture.startY,
    ) > 8;

    if (!gesture.dragStarted && movedEnough) {
      if (gesture.type === 'palette') {
        handleDragStart(gesture.shipSize);
      } else if (gesture.type === 'placed') {
        handleExistingShipDragStart(gesture.row, gesture.col);
      }
      gesture.dragStarted = true;
    }

    if (!gesture.dragStarted) return;

    const cell = getBoardCellFromPoint(touch.clientX, touch.clientY);
    setHoverCell(cell);
  };

  const handleTouchEnd = (e) => {
    const gesture = touchGestureRef.current;
    if (!gesture) {
      setIsTouchGestureActive(false);
      return;
    }

    if (gesture.dragStarted) {
      const touch = e.changedTouches?.[0];
      const cell = touch ? getBoardCellFromPoint(touch.clientX, touch.clientY) : null;
      if (cell) {
        tryDropDraggedShip(cell.row, cell.col);
      }

      suppressNextClickRef.current = true;
      handleDragEnd();
    } else if (gesture.type === 'placed') {
      suppressNextClickRef.current = true;
      handleShipClick(gesture.row, gesture.col);
    }

    touchGestureRef.current = null;
    setIsTouchGestureActive(false);
  };

  const isPreviewCell = (row, col) => {
    const currentDraggedShip = draggedShipRef.current;
    if (!hoverCell || !currentDraggedShip) return false;

    const previewDir = currentDraggedShip.orientation || orientation;
    if (previewDir === 'horizontal') {
      return row === hoverCell.row && col >= hoverCell.col && col < hoverCell.col + currentDraggedShip.size;
    }
    return col === hoverCell.col && row >= hoverCell.row && row < hoverCell.row + currentDraggedShip.size;
  };

  const isValidPreview = () => {
    const currentDraggedShip = draggedShipRef.current;
    if (!hoverCell || !currentDraggedShip) return false;
    const previewDir = currentDraggedShip.orientation || orientation;
    // Use base board (with dragged ship removed) for validation
    const baseBoard = dragBaseRef.current?.board || playerBoard;
    return canPlaceShip(baseBoard, hoverCell.row, hoverCell.col, currentDraggedShip.size, previewDir);
  };

  const getShipOrientation = (ship) => {
    if (!ship || !ship.positions || ship.positions.length < 2) return 'horizontal';
    const [first, second] = ship.positions;
    return first.x === second.x ? 'horizontal' : 'vertical';
  };

  const getShipAtCell = (row, col) => placedShips.find((ship) =>
    ship.positions.some((pos) => pos.x === row && pos.y === col)
  );

  const handleExistingShipDragStart = (row, col) => {
    if (!isPlacingShips) return;
    const ship = getShipAtCell(row, col);
    if (!ship) return;

    const newPlacedShips = placedShips.filter((s) => s !== ship);
    const newBoard = createEmptyBoard();
    newPlacedShips.forEach((s) => {
      s.positions.forEach((pos) => {
        newBoard[pos.x][pos.y] = CELL_TYPES.SHIP;
      });
    });

    setDragRestore({ board: playerBoard, ships: placedShips });
    // DO NOT update visual board - keep ship visible so drag continues
    // Store the base state (without dragged ship) in ref for validation
    dragBaseRef.current = { board: newBoard, ships: newPlacedShips };
    const draggedShipData = { size: ship.positions.length, orientation: getShipOrientation(ship) };
    setDraggedShip(draggedShipData);
    draggedShipRef.current = draggedShipData;
    setDidDrop(false);
    didDropRef.current = false;
  };

  const handleExistingShipTouchStart = (e, row, col) => {
    if (!isPlacingShips) return;
    const ship = getShipAtCell(row, col);
    if (!ship) return;

    const touch = e.touches?.[0];
    if (!touch) return;

    setIsTouchGestureActive(true);

    touchGestureRef.current = {
      type: 'placed',
      row,
      col,
      startX: touch.clientX,
      startY: touch.clientY,
      dragStarted: false,
    };
  };

  // Helper function to check if a ship position is valid (doesn't overlap or go out of bounds)
  const isShipPositionValid = (positions, width = BOARD_SIZE, height = BOARD_SIZE, shipToExclude = null) => {
    // Check bounds
    for (const pos of positions) {
      if (pos.x < 0 || pos.x >= height || pos.y < 0 || pos.y >= width) {
        return false;
      }
    }

    // Check overlaps with other ships
    const posSet = new Set(positions.map(p => `${p.x},${p.y}`));
    for (const ship of placedShips) {
      if (shipToExclude && ship === shipToExclude) continue;
      for (const pos of ship.positions) {
        if (posSet.has(`${pos.x},${pos.y}`)) {
          return false;
        }
      }
    }

    // Check adjacency - no ship should be adjacent to another ship
    for (const pos of positions) {
      // Check all 8 surrounding cells
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue; // skip the cell itself

          const newR = pos.x + dr;
          const newC = pos.y + dc;

          // Check if neighbor is within bounds
          if (newR >= 0 && newR < height && newC >= 0 && newC < width) {
            // Check if neighbor is part of THIS ship (allowed)
            const isPartOfCurrentShip = posSet.has(`${newR},${newC}`);

            // If not part of this ship, check if it's occupied by another ship
            if (!isPartOfCurrentShip) {
              for (const ship of placedShips) {
                if (shipToExclude && ship === shipToExclude) continue;
                if (ship.positions.some(p => p.x === newR && p.y === newC)) {
                  return false; // Adjacent to another ship
                }
              }
            }
          }
        }
      }
    }

    return true;
  };

  // Funkcja obrotu klikniętego statku
  const handleShipClick = (row, col) => {
    if (!isPlacingShips) return;
    const ship = getShipAtCell(row, col);
    if (!ship) return;

    // Get the ship's current orientation and calculate new one
    const shipCurrentOrientation = getShipOrientation(ship);
    const newOrientation = shipCurrentOrientation === 'horizontal' ? 'vertical' : 'horizontal';

    // Find the top-left corner of the ship
    const positions = ship.positions.sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
    const startRow = positions[0].x;
    const startCol = positions[0].y;

    // Check bounds first
    const wouldBeOutOfBounds = newOrientation === 'horizontal'
      ? (startCol + ship.size > BOARD_SIZE)
      : (startRow + ship.size > BOARD_SIZE);

    if (wouldBeOutOfBounds) {
      setStatusMessage('Cannot rotate - ship would go out of bounds.');
      return;
    }

    // Create a temporary board without this ship for validation
    const otherShips = placedShips.filter((s) => s !== ship);
    const tempBoard = createEmptyBoard();
    otherShips.forEach((s) => {
      s.positions.forEach((pos) => {
        tempBoard[pos.x][pos.y] = CELL_TYPES.SHIP;
      });
    });

    // Check if rotation is valid on temporary board
    const isValid = canPlaceShip(tempBoard, startRow, startCol, ship.size, newOrientation);
    if (!isValid) {
      setStatusMessage('Warning: Ship position is invalid (overlapping or adjacent). Fix before starting game.');
    } else {
      setStatusMessage(`Ship rotated to ${newOrientation}.`);
    }

    // Calculate rotated positions
    const shipPositions = [];
    if (newOrientation === 'horizontal') {
      for (let c = startCol; c < startCol + ship.size; c += 1) {
        shipPositions.push({ x: startRow, y: c });
      }
    } else {
      for (let r = startRow; r < startRow + ship.size; r += 1) {
        shipPositions.push({ x: r, y: startCol });
      }
    }

    // Apply rotation even if invalid (allows user to see and fix)
    const shipIndex = placedShips.indexOf(ship);
    const updatedShips = [...placedShips];
    updatedShips[shipIndex] = { size: ship.size, positions: shipPositions };

    const newBoard = createEmptyBoard();
    updatedShips.forEach((s) => {
      s.positions.forEach((pos) => {
        newBoard[pos.x][pos.y] = CELL_TYPES.SHIP;
      });
    });

    setPlacedShips(updatedShips);
    setPlayerBoard(newBoard);
    setOrientation(newOrientation);

    if (gameId) {
      localStorage.setItem(`game_${gameId}_ships`, JSON.stringify({
        board: newBoard,
        ships: updatedShips
      }));
    }
  };

  const handlePlayerCellClick = (row, col) => {
    if (!isPlacingShips) return;

    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    handleShipClick(row, col);
  };

  // Funkcja forfeit gry
  const handleForfeit = () => {
    setShowForfeitConfirm(true);
  };

  // Funkcja potwierdzenia forfeit
  const confirmForfeit = async () => {
    setShowForfeitConfirm(false);

    if (!gameId) {
      setStatusMessage('Game not ready.');
      return;
    }

    try {
      // Send forfeit via WebSocket
      gameSocket.sendForfeit();

      await axios.post(
        `${API_BASE_URL}/games/${gameId}/forfeit/`,
        {},
        { withCredentials: true }
      );

      // Clean up localStorage when game ends
      localStorage.removeItem(`game_${gameId}_ships`);

      setGameResult('lose');
      setRedirectCountdown(3);
      setStatusMessage('Game forfeited. You lose!');
    } catch (err) {
      setStatusMessage(err.response?.data?.error || 'Error forfeiting game. Please try again.');
      setShowForfeitConfirm(false);
    }
  };

  // Funkcja resetowania gry do nowej rozgrywki
  const resetGameForNewRound = () => {
    // For PvP games, redirect to menu instead of auto-creating a new AI game
    if (gameMode === 'pvp') {
      gameSocket.reset();
      navigate('/menu');
      return;
    }

    // Reset WebSocket state for new game (clears game ended flag)
    gameSocket.reset();

    // Clear all game state
    setGameId(null);
    setGameInitialized(false);
    setGameResult(null);
    setRedirectCountdown(3);
    setPlayerBoard(createEmptyBoard());
    setEnemyBoard(createEmptyBoard());
    setIsPlacingShips(true);
    setOrientation('horizontal');
    setStatusMessage('Place your ships on your board.');
    setPlacedShips([]);
    setIsMyTurn(false);
    setIsWaitingForResponse(false);
    setShotHistory([]);
    setChatMessages([]);
    setGameMode('ai');
    setOpponentName('AI');
    initializingRef.current = false;
    setGameLoading(true);

    // Reinitialize game
    const initializeNewGame = async () => {
      try {
        const response = await axios.post(
          `${API_BASE_URL}/games/`,
          { game_type: 'ai' },
          { withCredentials: true }
        );
        setGameId(response.data.id);
        setGameInitialized(true);
        setStatusMessage('Game created! Place your ships on your board.');
        setError(null);
      } catch (err) {
        const errorMsg = err.response?.data?.error || err.response?.data?.detail || 'Failed to create game';
        setError(errorMsg);
        setStatusMessage('Error creating game. Please try again.');
      } finally {
        setGameLoading(false);
      }
    };

    initializeNewGame();
  };

  // Funkcja losowego rozmieszczenia statków
  const randomizeShips = () => {
    // Clear the board before attempting random placement to avoid inconsistent state
    const cleanBoard = createEmptyBoard();
    let newPlacedShips = [];
    const shipSizes = [...allShips];
    let remainingBoardAttempts = 50;

    // Próbujemy wielokrotnie wygenerować pełne ustawienie wszystkich statków
    while (remainingBoardAttempts > 0) {
      const attemptBoard = createEmptyBoard();
      const attemptShips = [];

      // Tasujemy orientacje i pozycje dla każdego statku
      for (const size of shipSizes) {
        let placed = false;
        let attempts = 0;

        while (!placed && attempts < 100) {
          const randomRow = Math.floor(Math.random() * BOARD_SIZE);
          const randomCol = Math.floor(Math.random() * BOARD_SIZE);
          const randomOrientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

          if (canPlaceShip(attemptBoard, randomRow, randomCol, size, randomOrientation)) {
            const shipPositions = [];

            if (randomOrientation === 'horizontal') {
              for (let c = randomCol; c < randomCol + size; c += 1) {
                attemptBoard[randomRow][c] = CELL_TYPES.SHIP;
                shipPositions.push({ x: randomRow, y: c });
              }
            } else {
              for (let r = randomRow; r < randomRow + size; r += 1) {
                attemptBoard[r][randomCol] = CELL_TYPES.SHIP;
                shipPositions.push({ x: r, y: randomCol });
              }
            }

            attemptShips.push({
              size: size,
              positions: shipPositions
            });
            placed = true;
          }
          attempts += 1;
        }

        // Jeśli nie udało się umieścić tego statku, przerywamy tę próbę ustawienia
        if (!placed) {
          break;
        }
      }

      // Jeśli udało się umieścić wszystkie statki, kończymy pętlę
      if (attemptShips.length === shipSizes.length) {
        newPlacedShips = attemptShips;
        break;
      }

      remainingBoardAttempts -= 1;
    }

    // Jeśli po wielu próbach nadal nie udało się rozmieścić wszystkich statków, zgłaszamy błąd
    if (newPlacedShips.length !== shipSizes.length) {
      setStatusMessage('Error: Unable to place all ships randomly. Please try again.');
      setPlayerBoard(cleanBoard);
      setPlacedShips([]);
      return;
    }

    // Build the final board from successfully placed ships
    const finalBoard = createEmptyBoard();
    newPlacedShips.forEach((ship) => {
      ship.positions.forEach((pos) => {
        finalBoard[pos.x][pos.y] = CELL_TYPES.SHIP;
      });
    });

    setPlayerBoard(finalBoard);
    setPlacedShips(newPlacedShips);
    setStatusMessage('Ships placed randomly! Click "Start Game" to begin.');

    if (gameId) {
      localStorage.setItem(`game_${gameId}_ships`, JSON.stringify({
        board: finalBoard,
        ships: newPlacedShips
      }));
    }
  };

  // Funkcja obsługująca kliknięcie pola na planszy przeciwnika.
  const handleEnemyCellClick = async (row, col) => {
    // Jeśli nadal rozmieszczamy statki, nie można strzelać.
    if (isPlacingShips) {
      setStatusMessage('Finish placing ships before shooting.');
      return;
    }

    if (!isMyTurn) {
      setStatusMessage('Wait for your turn!');
      return;
    }

    if (isWaitingForResponse) {
      setStatusMessage('Waiting for response...');
      return;
    }

    if (!gameId) {
      setStatusMessage('Game not ready.');
      return;
    }

    // Sprawdzamy czy pole już było strzelane.
    if (enemyBoard[row][col] === CELL_TYPES.HIT || enemyBoard[row][col] === CELL_TYPES.MISS) {
      setStatusMessage('You already shot here.');
      return;
    }

    try {
      // Send shot via WebSocket
      const success = gameSocket.sendShot(row, col);

      if (!success) {
        setStatusMessage('Connection lost. Please reconnect.');
        return;
      }

      // Mark as waiting for response
      setIsWaitingForResponse(true);
      setStatusMessage(`Shot fired at ${formatBoardCoordinate(row, col)}. Waiting for response...`);

      // Safety timeout: clear waiting state after 10 seconds if no response
      const timeoutId = setTimeout(() => {
        setIsWaitingForResponse(false);
        setStatusMessage('Response timeout. Please try again.');
      }, 10000);

      // Store timeout ID so we can cancel it when response arrives
      window.shotTimeoutId = timeoutId;

    } catch (err) {
      setStatusMessage('Error processing shot.');
    }
  };

  // Funkcja kończąca rozmieszczanie statków.
  const finishPlacement = async () => {
    if (placedShips.length === 0) {
      setStatusMessage('You must place at least one ship before starting!');
      return;
    }

    if (placedShips.length < allShips.length) {
      setStatusMessage(`You must place all ${allShips.length} ships before starting! (${placedShips.length} placed)`);
      return;
    }

    // Check if any ships are overlapping
    const allPlacedPositions = new Set();
    for (const ship of placedShips) {
      for (const pos of ship.positions) {
        const posKey = `${pos.x},${pos.y}`;
        if (allPlacedPositions.has(posKey)) {
          setStatusMessage('Ships are overlapping! Fix all overlaps before starting.');
          return;
        }
        allPlacedPositions.add(posKey);
      }
    }

    // Validate that no ships are adjacent to each other
    const tempBoard = createEmptyBoard();
    placedShips.forEach((ship) => {
      ship.positions.forEach((pos) => {
        tempBoard[pos.x][pos.y] = CELL_TYPES.SHIP;
      });
    });

    // Check each ship individually
    for (const ship of placedShips) {
      // Create a board without this ship
      const boardWithoutShip = createEmptyBoard();
      placedShips.filter(s => s !== ship).forEach((s) => {
        s.positions.forEach((pos) => {
          boardWithoutShip[pos.x][pos.y] = CELL_TYPES.SHIP;
        });
      });

      // Get ship's start position and orientation
      const positions = ship.positions.sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
      const startRow = positions[0].x;
      const startCol = positions[0].y;
      const shipOrientation = getShipOrientation(ship);

      // Validate placement
      if (!canPlaceShip(boardWithoutShip, startRow, startCol, ship.size, shipOrientation)) {
        setStatusMessage('Ships are adjacent to each other! Fix positions before starting.');
        return;
      }
    }

    if (!gameId) {
      setStatusMessage('Game not ready.');
      return;
    }

    try {
      const allShipPositions = placedShips.flatMap(ship => ship.positions);

      const response = await axios.post(
        `${API_BASE_URL}/games/${gameId}/ships/`,
        {
          ship_type: 'fleet',
          positions: allShipPositions
        },
        { withCredentials: true }
      );

      localStorage.removeItem(`game_${gameId}_ships`);

      setIsPlacingShips(false);

      if (gameMode === 'pvp') {
        if (response.data?.timer_seconds != null) {
          // I placed first — opponent hasn't placed yet. Start countdown and enter waiting state.
          if (pvpPlacementTimerRef.current) clearInterval(pvpPlacementTimerRef.current);
          let secs = response.data.timer_seconds;
          setPvpPlacementSecondsLeft(secs);
          pvpPlacementTimerRef.current = setInterval(() => {
            secs -= 1;
            if (secs <= 0) {
              clearInterval(pvpPlacementTimerRef.current);
              pvpPlacementTimerRef.current = null;
              setPvpPlacementSecondsLeft(0);
            } else {
              setPvpPlacementSecondsLeft(secs);
            }
          }, 1000);
          setIsPvpWaiting(true);
          setStatusMessage('Ships placed! Waiting for opponent to place their ships...');
          gameSocket.connect(gameId);  // game_start comes via WS when opponent places
        } else if (response.data?.game_started) {
          // I placed last — game is now active. Apply state directly from REST (no WS race).
          if (pvpPlacementTimerRef.current) { clearInterval(pvpPlacementTimerRef.current); pvpPlacementTimerRef.current = null; }
          setPvpPlacementSecondsLeft(null);
          setIsPvpWaiting(false);
          const iAmFirst = response.data.starting_player_id === user.id?.toString();
          setIsMyTurn(iAmFirst);
          setStatusMessage(iAmFirst ? 'Game started! Your turn — shoot on enemy board.' : `Game started! Waiting for ${opponentName}'s move...`);
          gameSocket.connect(gameId);  // connect for actual game play (shots, chat, etc.)
        } else {
          // Fallback: no extra info, just connect and let WS event handle it
          gameSocket.connect(gameId);
        }
      } else {
        // Connect to WebSocket for game communication
        gameSocket.connect(
          gameId,
          () => {
            console.log('Connected to WS');
          },
          (error) => {
            setStatusMessage('Connection error: ' + error.message);
          }
        );
        // For AI, immediately set turn and status since we don't wait for opponent placement
        setStatusMessage('Game started! Your turn - shoot on enemy board.');
        setIsMyTurn(true);
      }
    } catch (err) {
      // 409 means ships were already placed - this can happen if the game continued from a previous session
      if (err.response?.status === 409) {
        localStorage.removeItem(`game_${gameId}_ships`);
        setIsPlacingShips(false);
        if (gameMode === 'pvp') {
          setIsPvpWaiting(true);
          setStatusMessage('Ships already placed! Waiting for opponent...');
          gameSocket.connect(gameId);
        } else {
          setIsMyTurn(true);
          setStatusMessage('Game started! Your turn - shoot on enemy board.');
          gameSocket.connect(gameId);
        }
      } else {
        setStatusMessage(err.response?.data?.error || 'Error placing ships. Please try again.');
      }
    }
  };

  const resetShips = () => {
    setPlayerBoard(createEmptyBoard());
    setPlacedShips([]);
    setStatusMessage('Ships cleared. Place your ships on your board.');
    if (gameId) {
      localStorage.removeItem(`game_${gameId}_ships`);
    }
  };

  const getCellClass = (cellType, isEnemy) => {
    // Klasy bazowe dla wszystkich pól - responsive with aspect ratio
    const base = 'aspect-square border border-slate-700 flex items-center justify-center';
    // Jeśli to plansza przeciwnika, statki nie są widoczne.
    if (isEnemy) {
      // Dla przeciwnika pokazujemy tylko trafienia i pudła.
      if (cellType === CELL_TYPES.HIT) return `${base} bg-red-500`;
      if (cellType === CELL_TYPES.MISS) return `${base} bg-slate-500`;
      return `${base} bg-slate-800 hover:bg-slate-700 cursor-pointer`;
    }
    // Dla planszy gracza pokazujemy statki.
    if (cellType === CELL_TYPES.SHIP) return `${base} bg-emerald-500`;
    if (cellType === CELL_TYPES.HIT) return `${base} bg-red-500`;
    if (cellType === CELL_TYPES.MISS) return `${base} bg-slate-500`;
    return `${base} bg-slate-800`;
  };

  const getPlayerCellClass = (cellType, row, col) => {
    const base = 'aspect-square border border-slate-700 flex items-center justify-center';

    if (isPreviewCell(row, col)) {
      return `${base} ${isValidPreview() ? 'bg-emerald-400/60' : 'bg-red-400/60'}`;
    }

    if (cellType === CELL_TYPES.SHIP) {
      // Check if this cell is part of an invalid ship (overlapping with another)
      const shipAtCell = getShipAtCell(row, col);
      if (shipAtCell && !isShipPositionValid(shipAtCell.positions, BOARD_SIZE, BOARD_SIZE, shipAtCell)) {
        return `${base} bg-red-500 animate-pulse`;
      }
      return `${base} bg-emerald-500`;
    }
    if (cellType === CELL_TYPES.HIT) return `${base} bg-red-500`;
    if (cellType === CELL_TYPES.MISS) return `${base} bg-slate-500`;
    return `${base} bg-slate-800`;
  };

  const shouldDisableTouchPanning = isPlacingShips;

  // Render komponentu Body.
  return (
    // Główny kontener strony.
    <div className="space-y-6 w-full max-w-6xl mx-auto text-white" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchCancel={handleTouchEnd}>

      {/* Chat toast — incoming opponent message, fixed top-right */}
      {chatToast && (
        <div className="fixed top-4 right-4 z-50 max-w-xs bg-slate-800 border border-indigo-500 rounded-lg shadow-lg px-4 py-3 text-white">
          <p className="text-xs text-indigo-400 font-semibold mb-1">💬 {chatToast.senderUsername}</p>
          <p className="text-sm break-words">{chatToast.message}</p>
        </div>
      )}
      {/* <div className="text-white"> */}
      <div className="mx-auto mb-6 flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Game-aware back to menu button */}
        <div>
          <button
            onClick={async () => {
              if (!isPlacingShips && !isPvpWaiting && gameResult === null && gameId) {
                // Active game — warn about forfeit
                setShowLeaveConfirm(true);
                setPendingLeaveAction('menu');
              } else if (gameId && gameMode === 'pvp' && (isPvpWaiting || isPlacingShips)) {
                // Pending PvP (waiting or still placing) — cancel game so opponent is notified
                try {
                  await axios.post(`${API_BASE_URL}/games/${gameId}/cancel/`, {}, { withCredentials: true });
                } catch (e) { }
                if (pvpPlacementTimerRef.current) { clearInterval(pvpPlacementTimerRef.current); pvpPlacementTimerRef.current = null; }
                setPvpPlacementSecondsLeft(null);
                navigate('/menu');
              } else if (gameId && gameMode === 'ai' && isPlacingShips) {
                // AI ship placement — cancel so the Redis active_game key is freed immediately
                try {
                  await axios.post(`${API_BASE_URL}/games/${gameId}/cancel/`, {}, { withCredentials: true });
                } catch (e) { }
                navigate('/menu');
              } else {
                navigate('/menu');
              }
            }}
            className="inline-flex w-full items-center justify-center rounded-md bg-slate-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 sm:w-auto sm:text-base"
          >
            ← Back to Menu
          </button>
        </div>

        {/* Tytuł strony */}
        <h1 className="text-center text-xl font-bold leading-tight break-words sm:text-right sm:text-2xl lg:text-3xl">
          Game Board <span className="block sm:inline">(vs {opponentName})</span>
        </h1>
      </div>

      {/* Komunikat o błędzie */}
      {error && (
        <div className="max-w-6xl mx-auto mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
          Error: {error}
        </div>
      )}

      {/* Komunikat ładowania */}
      {showLoadingBanner && (
        <div className="max-w-6xl mx-auto mb-6 p-4 bg-blue-500/20 border border-blue-500 rounded-lg text-blue-200">
          {isCreatingGame ? (gameMode === 'pvp' ? 'Creating PvP game...' : 'Creating AI game...') : 'Loading game...'}
        </div>
      )}

      {/* Modal forfeit confirmation */}
      {showForfeitConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Forfeit Game?</h3>
            <p className="text-slate-300 mb-6">Are you sure you want to forfeit? You will lose the game.</p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded font-semibold transition-colors"
                onClick={() => setShowForfeitConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold transition-colors"
                onClick={confirmForfeit}
              >
                Forfeit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Leave game confirmation (Back to Menu / Logout during active game) */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-red-500 rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-xl font-bold text-white mb-4">Leave Game?</h3>
            <p className="text-slate-300 mb-6">
              Leaving will <span className="text-red-400 font-bold">forfeit</span> the current game. You will lose.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                className="w-full sm:w-auto px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded font-semibold transition-colors"
                onClick={() => {
                  setShowLeaveConfirm(false);
                  setPendingLeaveAction(null);
                }}
              >
                Stay in Game
              </button>
              <button
                className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 rounded font-semibold transition-colors"
                onClick={async () => {
                  setShowLeaveConfirm(false);
                  // Forfeit the game first
                  if (gameId) {
                    try {
                      gameSocket.sendForfeit();
                      await axios.post(
                        `${API_BASE_URL}/games/${gameId}/forfeit/`,
                        {},
                        { withCredentials: true }
                      );
                      localStorage.removeItem(`game_${gameId}_ships`);
                    } catch (err) {
                      // Continue with navigation even if forfeit fails
                    }
                  }
                  if (pendingLeaveAction === 'menu') {
                    navigate('/menu');
                  }
                  // 'logout' is handled by Components.js LogoutButton
                  setPendingLeaveAction(null);
                }}
              >
                Forfeit & Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Opponent disconnected notice with 60s reconnect countdown */}
      {opponentDisconnectedNotice && (
        <div className="mx-4 mb-4 rounded-lg border border-yellow-500 bg-yellow-500/20 p-3 text-center text-sm text-yellow-200 break-words sm:mx-auto sm:max-w-6xl sm:p-4 sm:text-base">
          <span className="font-bold">{opponentName}</span> disconnected.{' '}
          {opponentReconnectCountdown !== null && opponentReconnectCountdown > 0 ? (
            <span>
              They have{' '}
              <span className={`font-bold ${opponentReconnectCountdown <= 10 ? 'text-red-400' : ''}`}>{opponentReconnectCountdown}s</span>{' '}
              to reconnect, otherwise they forfeit.
            </span>
          ) : (
            <span>Waiting for them to reconnect...</span>
          )}
        </div>
      )}

      {/* PvP waiting overlay: ships placed, waiting for opponent — shows live countdown */}
      {isPvpWaiting && (
        <div className="mx-4 mb-4 rounded-lg border border-blue-500 bg-blue-500/20 p-4 text-center text-blue-200 break-words sm:mx-auto sm:max-w-6xl sm:p-6">
          <div className="mb-2 text-base font-semibold sm:text-lg">⏳ Waiting for {opponentName} to place their ships...</div>
          {pvpPlacementSecondsLeft !== null ? (
            <div className={`mt-1 text-xl font-bold sm:text-2xl ${pvpPlacementSecondsLeft <= 10 ? 'text-red-400' : 'text-blue-300'}`}>
              {pvpPlacementSecondsLeft}s
            </div>
          ) : (
            <div className="text-xs text-slate-400 sm:text-sm">You will be notified when the game starts.</div>
          )}
        </div>
      )}

      {/* You Lose Message */}
      {gameResult === 'lose' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border-4 border-red-500 rounded-lg p-8 max-w-sm mx-4 text-center">
            <h2 className="text-4xl font-bold text-red-500 mb-4">YOU LOSE</h2>
            <p className="text-slate-300 mb-6">Redirecting to menu in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}...</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={resetGameForNewRound}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded"
              >
                {gameMode === 'pvp' ? 'Back to Menu' : 'Play Again'}
              </button>
              {gameMode !== 'pvp' && (
                <button
                  onClick={() => navigate('/menu')}
                  className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-6 rounded"
                >
                  Return to Menu
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {gameResult === 'win' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border-4 border-emerald-500 rounded-lg p-8 max-w-sm mx-4 text-center">
            <h2 className="text-4xl font-bold text-emerald-400 mb-4">YOU WON</h2>
            <p className="text-slate-300 mb-6">Redirecting to menu in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}...</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={resetGameForNewRound}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded"
              >
                {gameMode === 'pvp' ? 'Back to Menu' : 'Play Again'}
              </button>
              {gameMode !== 'pvp' && (
                <button
                  onClick={() => navigate('/menu')}
                  className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-6 rounded"
                >
                  Return to Menu
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Panel sterowania */}
      <div className="max-w-6xl mx-auto mb-6 px-4">
        {/* Player 2 countdown: timer from opponent placing ships first */}
        {isPlacingShips && pvpPlacementSecondsLeft !== null && (
          <div className={`mb-3 p-3 rounded-lg border text-center ${pvpPlacementSecondsLeft <= 10 ? 'bg-red-500/20 border-red-500 text-red-300' : 'bg-yellow-500/20 border-yellow-500 text-yellow-200'}`}>
            <span className="font-semibold">⚠️ Opponent is ready!</span>{' '}
            Place all your ships within{' '}
            <span className={`font-bold text-lg ${pvpPlacementSecondsLeft <= 10 ? 'text-red-400' : 'text-yellow-100'}`}>{pvpPlacementSecondsLeft}s</span>
          </div>
        )}

        {/* Status gry */}
        <div className="text-slate-300 text-center sm:text-left mb-3 text-sm sm:text-base">{statusMessage}</div>

        {/* Sterowanie rozmieszczaniem */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Panel statków do przeciągania */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {isPlacingShips && (
              <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-800/60 border border-slate-600 rounded px-2 py-2 sm:px-3">
                <span className="text-xs text-slate-300 whitespace-nowrap">Drag ships:</span>
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {remainingShips.map((size, idx) => (
                    <div
                      key={`ship-${size}-${idx}`}
                      className="flex items-center gap-0.5 cursor-grab active:cursor-grabbing touch-none"
                      draggable
                      onDragStart={(e) => handleDragStart(size, e)}
                      onDragEnd={handleDragEnd}
                      onTouchStart={(e) => handleShipTouchStart(size, e)}
                      title={`Ship size ${size}`}
                    >
                      {Array.from({ length: size }).map((_, blockIdx) => (
                        <div
                          key={`ship-${size}-${idx}-${blockIdx}`}
                          className="w-4 h-4 bg-emerald-500 border border-emerald-700"
                        />
                      ))}
                    </div>
                  ))}
                  {remainingShips.length === 0 && (
                    <span className="text-xs text-slate-400">All ships placed</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Akcje po prawej stronie */}
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 w-full sm:w-auto">
            {isPlacingShips && (
              <button
                className="px-3 py-1.5 sm:py-2 text-sm sm:text-base bg-blue-600 rounded hover:bg-blue-500 whitespace-nowrap"
                onClick={randomizeShips}
              >
                Random Placement
              </button>
            )}

            {/* Przycisk kończący rozmieszczanie */}
            <button
              className="px-3 py-1.5 sm:py-2 text-sm sm:text-base bg-emerald-600 rounded hover:bg-emerald-500 disabled:bg-slate-600 disabled:cursor-not-allowed whitespace-nowrap"
              onClick={finishPlacement}
              disabled={!isPlacingShips || placedShips.length < allShips.length}
            >
              {/* Tekst przycisku zakończenia */}
              Start Game {isPlacingShips && `(${placedShips.length}/${allShips.length})`}
            </button>

            {/* Przycisk forfeit */}
            {!isPlacingShips && !isPvpWaiting && gameResult === null && (
              <button
                className="px-3 py-1.5 sm:py-2 text-sm sm:text-base bg-red-700 rounded hover:bg-red-600 whitespace-nowrap"
                onClick={handleForfeit}
              >
                Forfeit Game
              </button>
            )}

            {/* Przycisk resetowania statków */}
            {isPlacingShips && placedShips.length > 0 && (
              <button
                className="px-3 py-1.5 sm:py-2 text-sm sm:text-base bg-red-600 rounded hover:bg-red-500 whitespace-nowrap"
                onClick={resetShips}
              >
                Reset Ships
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sekcja plansz */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Plansza gracza */}
        <div className="bg-slate-800/60 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Your Board</h2>
          {/* Siatka planszy gracza */}
          <div className="w-full max-w-md mx-auto">
            {/* Column labels */}
            <div className="flex mb-1">
              <div className="w-6 h-6"></div>
              {Array.from({ length: BOARD_SIZE }).map((_, i) => (
                <div key={`col-label-${i}`} className="flex-1 text-center text-xs text-slate-400 font-semibold">
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            {/* Board rows with row labels */}
            <div>
              {playerBoard.map((row, rowIdx) => (
                <div key={`row-${rowIdx}`} className="flex">
                  <div className="w-6 h-6 flex items-center justify-center text-xs text-slate-400 font-semibold">
                    {rowIdx + 1}
                  </div>
                  <div className="flex-1 grid gap-0" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}>
                    {row.map((cell, colIdx) => (
                      <div
                        key={`p-${rowIdx}-${colIdx}`}
                        data-player-cell="true"
                        data-row={rowIdx}
                        data-col={colIdx}
                        className={`${getPlayerCellClass(cell, rowIdx, colIdx)} ${shouldDisableTouchPanning ? 'touch-none' : ''}`}
                        onDragOver={(e) => handleDragOver(e, rowIdx, colIdx)}
                        onDrop={(e) => handleDrop(e, rowIdx, colIdx)}
                        onDragLeave={handleDragLeave}
                        draggable={isPlacingShips && cell === CELL_TYPES.SHIP}
                        onDragStart={() => handleExistingShipDragStart(rowIdx, colIdx)}
                        onDragEnd={handleDragEnd}
                        onTouchStart={(e) => handleExistingShipTouchStart(e, rowIdx, colIdx)}
                        onClick={() => handlePlayerCellClick(rowIdx, colIdx)}
                        title={isPlacingShips && cell === CELL_TYPES.SHIP ? 'Click to rotate' : ''}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Plansza przeciwnika */}
        <div className="bg-slate-800/60 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">{opponentName}'s Board</h2>
          {/* Siatka planszy przeciwnika */}
          <div className="w-full max-w-md mx-auto">
            {/* Column labels */}
            <div className="flex mb-1">
              <div className="w-6 h-6"></div>
              {Array.from({ length: BOARD_SIZE }).map((_, i) => (
                <div key={`col-label-e-${i}`} className="flex-1 text-center text-xs text-slate-400 font-semibold">
                  {String.fromCharCode(65 + i)}
                </div>
              ))}
            </div>
            {/* Board rows with row labels */}
            <div>
              {enemyBoard.map((row, rowIdx) => (
                <div key={`row-e-${rowIdx}`} className="flex">
                  <div className="w-6 h-6 flex items-center justify-center text-xs text-slate-400 font-semibold">
                    {rowIdx + 1}
                  </div>
                  <div className="flex-1 grid gap-0" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}>
                    {row.map((cell, colIdx) => (
                      <div
                        key={`e-${rowIdx}-${colIdx}`}
                        className={getCellClass(cell, true) + (isWaitingForResponse || !isMyTurn ? ' opacity-50 cursor-not-allowed' : ' cursor-pointer')}
                        onClick={() => !isWaitingForResponse && isMyTurn && handleEnemyCellClick(rowIdx, colIdx)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Game Chat — only visible once the game is active (both players placed ships) */}
      {!isPlacingShips && !isPvpWaiting && (
        <div className="max-w-6xl mx-auto mt-8 px-4">
          <div className="bg-slate-800/60 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">💬 Game Chat</h3>

            {/* Messages area */}
            <div ref={chatScrollRef} className="overflow-y-auto space-y-2 mb-3 border border-slate-700 rounded-lg p-3 bg-slate-900/40" style={{ maxHeight: '240px', minHeight: '80px' }}>
              {chatMessages.length === 0 && (
                <p className="text-xs text-slate-500 text-center mt-4">No messages yet. Say hi!</p>
              )}
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.isMe ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-xs text-slate-400 mb-0.5">
                    {msg.isMe ? 'You' : msg.senderUsername}
                  </span>
                  <div
                    className={`px-3 py-1.5 rounded-lg text-sm max-w-[70%] break-words ${msg.isMe
                      ? 'bg-indigo-600 text-white'
                      : (gameMode === 'ai' && !msg.isMe)
                        ? 'bg-amber-600/80 text-white'
                        : 'bg-slate-700 text-slate-200'
                      }`}
                  >
                    {msg.message}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input area */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const text = chatInput.trim();
                if (!text) return;
                gameSocket.sendChat(text);
                setChatInput('');
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                maxLength={200}
                className="w-full flex-1 bg-slate-700 text-white text-sm rounded px-3 py-2 border border-slate-600 focus:border-indigo-500 focus:outline-none placeholder-slate-400"
              />
              <button
                type="submit"
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded font-semibold transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Shot History */}
      {!isPlacingShips && shotHistory.length > 0 && (
        <div className="max-w-6xl mx-auto mt-8 px-4">
          <div className="bg-slate-800/60 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Shot History</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-slate-300">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left p-2">Player</th>
                    <th className="text-left p-2">Target</th>
                    <th className="text-left p-2">Result</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...shotHistory].reverse().map((shot, idx) => (
                    <tr key={idx} className={`border-b border-slate-700 hover:bg-slate-700/30 ${shot.player === 'You'
                      ? 'bg-blue-900/10'
                      : 'bg-orange-900/10'
                      }`}>
                      <td className="p-2 font-semibold">{shot.player}</td>
                      <td className="p-2 font-mono">{String.fromCharCode(65 + shot.col)}{shot.row + 1}</td>
                      <td className="p-2">
                        <span className={shot.result === 'hit' ? 'text-red-400 font-semibold' : 'text-slate-400'}>
                          {shot.result === 'hit' ? '✓ HIT' : '✗ MISS'}
                        </span>
                      </td>
                      <td className="p-2">
                        {shot.sunk && (
                          <span className="text-emerald-400 font-semibold">🚢 {shot.sunk}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Główny komponent GameBoard.
function GameBoard() {
  return (
    <Template>
      <Body />
    </Template>
  );
}

// Eksportujemy komponent GameBoard jako domyślny.
export default GameBoard;
