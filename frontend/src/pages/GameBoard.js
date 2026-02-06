// Importujemy React i hooki do zarządzania stanem komponentu.
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Template } from './Components';
import API_BASE_URL from '../config';
import { AuthContext } from '../contexts/AuthContext';
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
  const { user } = useContext(AuthContext);
  
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
  
  // Stan dla forfeit
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);
  const [gameResult, setGameResult] = useState(null); // 'win', 'lose', or null
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  const [shotHistory, setShotHistory] = useState([]);
  
  // Stan dla WebSocket i gameplay
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);
  const socketRef = useRef(null);

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
  const restoreGameStateFromShots = (existingPlayerBoard, playerShots, opponentShots, playerInactiveAll = [], opponentInactiveAll = []) => {
    // Start with the existing player board (which has ships)
    const newPlayerBoard = existingPlayerBoard.map((r) => r.slice());
    const newEnemyBoard = createEmptyBoard();
    const newShotHistory = [];

    // Combine all shots with player identifier
    const allShots = [];
    if (opponentShots && Array.isArray(opponentShots)) {
      opponentShots.forEach(shot => {
        allShots.push({ ...shot, player: 'AI' });
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
        if (player === 'AI') {
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
            currentGameId = activeGameResponse.data.id;
            setGameId(currentGameId);
            setGameInitialized(true);
            
            try {
              const shipsStatusResponse = await axios.get(
                `${API_BASE_URL}/games/${currentGameId}/ships_status/`,
                { withCredentials: true }
              );
              
              if (shipsStatusResponse.data.player_1_ready && shipsStatusResponse.data.player_1_ships) {
                const shipData = shipsStatusResponse.data.player_1_ships;
                const { board, ships } = loadShipsToBoard(shipData.positions);

                setPlacedShips(ships);
                setIsPlacingShips(false);
                setIsMyTurn(false);
                setIsWaitingForResponse(false);
                
                // Fetch shots to restore game progress
                try {
                  const shotsResponse = await axios.get(
                    `${API_BASE_URL}/games/${currentGameId}/shots/`,
                    { withCredentials: true }
                  );
                  const { player_1_shots, player_2_shots, player_1_inactive, player_2_inactive, current_turn } = shotsResponse.data;
                  const restored = restoreGameStateFromShots(board, player_1_shots, player_2_shots, player_1_inactive, player_2_inactive);
                  setPlayerBoard(restored.playerBoard);
                  setEnemyBoard(restored.enemyBoard);
                  setShotHistory(restored.shotHistory);
                  
                  // Set whose turn it is
                  if (current_turn) {
                    setIsMyTurn(current_turn === user.id.toString());
                    setStatusMessage(current_turn === user.id.toString() ? 'Your turn - shoot on enemy board.' : 'Waiting for opponent...');
                  }
                } catch (shotsErr) {
                  // If we can't fetch shots, just use the ship board
                  console.error('Failed to restore shots:', shotsErr);
                  setPlayerBoard(board);
                }
                
                setStatusMessage('Ships already placed. Waiting for opponent...');
                localStorage.removeItem(`game_${currentGameId}_ships`);
                
                // Connect to WebSocket when loading existing in-progress game
                gameSocket.connect(currentGameId);
              } else {
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
              }
            } catch (statusErr) {
              setStatusMessage('Place your ships on your board.');
            }
            
            setError(null);
            setGameLoading(false);
            return;
          }
        } catch (activeErr) {
          if (activeErr.response?.status !== 404) {
            throw activeErr;
          }
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
              setGameId(existingGameId);
              setGameInitialized(true);

              try {
                const shipsStatusResponse = await axios.get(
                  `${API_BASE_URL}/games/${existingGameId}/ships_status/`,
                  { withCredentials: true }
                );

                if (shipsStatusResponse.data.player_1_ready && shipsStatusResponse.data.player_1_ships) {
                  const shipData = shipsStatusResponse.data.player_1_ships;
                  const { board, ships } = loadShipsToBoard(shipData.positions);

                  setPlacedShips(ships);
                  setIsPlacingShips(false);
                  setIsMyTurn(false);
                  setIsWaitingForResponse(false);
                  
                  // Fetch shots to restore game progress
                  try {
                    const shotsResponse = await axios.get(
                      `${API_BASE_URL}/games/${existingGameId}/shots/`,
                      { withCredentials: true }
                    );
                    const { player_1_shots, player_2_shots, player_1_inactive, player_2_inactive, current_turn } = shotsResponse.data;
                    const restored = restoreGameStateFromShots(board, player_1_shots, player_2_shots, player_1_inactive, player_2_inactive);
                    setPlayerBoard(restored.playerBoard);
                    setEnemyBoard(restored.enemyBoard);
                    setShotHistory(restored.shotHistory);
                    
                    // Set whose turn it is
                    if (current_turn) {
                      setIsMyTurn(current_turn === user.id.toString());
                      setStatusMessage(current_turn === user.id.toString() ? 'Your turn - shoot on enemy board.' : 'Waiting for opponent...');
                    }
                  } catch (shotsErr) {
                    // If we can't fetch shots, just use the ship board
                    console.error('Failed to restore shots:', shotsErr);
                    setPlayerBoard(board);
                  }
                  
                  setStatusMessage('Ships already placed. Waiting for opponent...');
                  localStorage.removeItem(`game_${existingGameId}_ships`);
                  
                  // Connect to WebSocket when loading existing in-progress game
                  gameSocket.connect(existingGameId);
                } else {
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
            
            const newEnemyBoard = enemyBoard.map((r) => r.slice());
            newEnemyBoard[row][col] = result === 'hit' ? CELL_TYPES.HIT : CELL_TYPES.MISS;
            const nextEnemyBoard = applyInactiveCells(newEnemyBoard, inactive);
            setEnemyBoard(nextEnemyBoard);
            
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
              setStatusMessage(result === 'hit' ? '🎯 Hit! Shoot again.' : '💧 Miss! AI is shooting...');
            }
            
            // If hit, we keep turn
            setIsMyTurn(result === 'hit');
          } else {
            // Opponent (AI) shot at us
            const hitResult = result === 'hit' ? 'hit' : 'miss';
            
            // Add to shot history
            setShotHistory(prev => [...prev, {
              player: 'AI',
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
              setStatusMessage(`AI sunk a ship at ${row + 1}, ${col + 1}. They shoot again...`);
            } else {
              setStatusMessage(`AI shot at ${row + 1}, ${col + 1}. ${hitResult === 'hit' ? '🎯 They hit! They shoot again...' : '💧 They missed!'}`);
            }
            
            // If AI missed, it's our turn
            setIsMyTurn(hitResult === 'miss');
          }
        }
      });

      // Handle game ended
      gameSocket.on('game_ended', (data) => {
        if (data.winner_id === user.id) {
          setGameResult('win');
          setStatusMessage('🎉 You won!');
        } else {
          setGameResult('lose');
          setStatusMessage('💀 You lost!');
        }
      });

      // Handle game forfeit
      gameSocket.on('game_forfeit', (data) => {
        setGameResult(data.player_id === user.id ? 'lose' : 'win');
        setStatusMessage(data.player_id === user.id ? 'You forfeited.' : 'Opponent forfeited. You won!');
      });

      // Handle connected
      gameSocket.on('connected', (data) => {
        setIsMyTurn(true); // Player always goes first
        setStatusMessage('Game started! Your turn - shoot on enemy board.');
      });

      // Handle player joined
      gameSocket.on('player_joined', (data) => {
        // Player joined
      });
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
    };
  }, [isPlacingShips, gameId, user.id, enemyBoard, playerBoard, shotHistory]);

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
      // Disconnect from WebSocket
      gameSocket.disconnect();
      
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
    const currentDraggedShip = draggedShipRef.current;
    if (currentDraggedShip && isPlacingShips) {
      let success = false;
      // If dragRestore is set, we're moving an existing ship (not checking size availability)
      // If dragRestore is null, we're placing a new ship from sidebar (check availability)
      if (dragRestore) {
        // Use base state (with dragged ship removed) for validation
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
    }
    setDraggedShip(null);
    draggedShipRef.current = null;
    setHoverCell(null);
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
      setStatusMessage(`Shot fired at ${row + 1}, ${col + 1}. Waiting for response...`);
      
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
      
      await axios.post(
        `${API_BASE_URL}/games/${gameId}/ships/`,
        {
          ship_type: 'fleet',
          positions: allShipPositions
        },
        { withCredentials: true }
      );
      
      localStorage.removeItem(`game_${gameId}_ships`);
      
      setIsPlacingShips(false);
      
      // Connect to WebSocket for game communication
      gameSocket.connect(
        gameId,
        () => {
          setStatusMessage('Game started! Your turn - shoot on enemy board.');
          setIsMyTurn(true);
        },
        (error) => {
          setStatusMessage('Connection error: ' + error.message);
        }
      );
    } catch (err) {
        // 409 means ships were already placed - this can happen if the game continued from a previous session
        if (err.response?.status === 409) {
          localStorage.removeItem(`game_${gameId}_ships`);
          setIsPlacingShips(false);
          
          // Connect to WebSocket
          gameSocket.connect(
            gameId,
            () => {
              setStatusMessage('Game started! Your turn - shoot on enemy board.');
              setIsMyTurn(true);
            },
            (error) => {
              setStatusMessage('Connection error: ' + error.message);
            }
          );
          setStatusMessage('Game started! Your turn - shoot on enemy board.');
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

  // Render komponentu Body.
  return (
    // Główny kontener strony.
    <div className="text-white">
      {/* Przycisk powrotu do menu */}
      <div className="max-w-6xl mx-auto mb-4">
        <button
          onClick={() => navigate('/menu')}
          className="px-4 py-2 text-sm sm:text-base bg-slate-600 hover:bg-slate-700 rounded-md font-semibold transition-colors"
        >
          ← Back to Menu
        </button>
      </div>

      {/* Tytuł strony */}
      <h1 className="text-3xl font-bold text-center mb-6 max-w-6xl mx-auto">Battleship — Game Board (vs AI)</h1>

      {/* Komunikat o błędzie */}
      {error && (
        <div className="max-w-6xl mx-auto mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-200">
          Error: {error}
        </div>
      )}

      {/* Komunikat ładowania */}
      {showLoadingBanner && (
        <div className="max-w-6xl mx-auto mb-6 p-4 bg-blue-500/20 border border-blue-500 rounded-lg text-blue-200">
          {isCreatingGame ? 'Creating AI game...' : 'Loading game...'}
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
                Play Again
              </button>
              <button
                onClick={() => navigate('/menu')}
                className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-6 rounded"
              >
                Return to Menu
              </button>
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
                Play Again
              </button>
              <button
                onClick={() => navigate('/menu')}
                className="bg-slate-600 hover:bg-slate-700 text-white font-semibold py-2 px-6 rounded"
              >
                Return to Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel sterowania */}
      <div className="max-w-6xl mx-auto mb-6 px-4">
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
                      className="flex items-center gap-0.5 cursor-grab active:cursor-grabbing"
                      draggable
                      onDragStart={(e) => handleDragStart(size, e)}
                      onDragEnd={handleDragEnd}
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
            {!isPlacingShips && gameResult === null && (
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
                        className={getPlayerCellClass(cell, rowIdx, colIdx)}
                        onDragOver={(e) => handleDragOver(e, rowIdx, colIdx)}
                        onDrop={(e) => handleDrop(e, rowIdx, colIdx)}
                        onDragLeave={handleDragLeave}
                        draggable={isPlacingShips && cell === CELL_TYPES.SHIP}
                        onDragStart={() => handleExistingShipDragStart(rowIdx, colIdx)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleShipClick(rowIdx, colIdx)}
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
          <h2 className="text-xl font-semibold mb-3">Enemy Board</h2>
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
                    <tr key={idx} className={`border-b border-slate-700 hover:bg-slate-700/30 ${
                      shot.player === 'You' 
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
