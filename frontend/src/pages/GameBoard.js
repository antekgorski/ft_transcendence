// Importujemy React i hooki do zarządzania stanem komponentu.
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Template } from './Components';
import API_BASE_URL from '../config';
import { AuthContext } from '../contexts/AuthContext';

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
  
  // Stan dla forfeit
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);
  const [gameResult, setGameResult] = useState(null); // 'win', 'lose', or null
  const [redirectCountdown, setRedirectCountdown] = useState(3);
  
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

                setPlayerBoard(board);
                setPlacedShips(ships);
                setIsPlacingShips(false);
                setStatusMessage('Ships already placed. Your turn - shoot on enemy board.');
                localStorage.removeItem(`game_${currentGameId}_ships`);
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

                  setPlayerBoard(board);
                  setPlacedShips(ships);
                  setIsPlacingShips(false);
                  setStatusMessage('Ships already placed. Your turn - shoot on enemy board.');
                  localStorage.removeItem(`game_${existingGameId}_ships`);
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
              return;
            }
          }

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
  }, [user, loadShipsToBoard]);

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
    if (gameResult !== 'lose') return;

    if (redirectCountdown <= 0) {
      navigate('/menu');
      return;
    }

    const timer = setTimeout(() => {
      setRedirectCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [redirectCountdown, gameResult, navigate]);

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

  // Funkcja umieszczająca statek na planszy gracza.
  const placeShip = (row, col, shipSize) => {
    // Sprawdzamy czy wybrany rozmiar statku jest jeszcze dostępny
    const canPlaceThisSize = remainingShips.includes(shipSize);
    if (!canPlaceThisSize) {
      setStatusMessage(`No more ships of size ${shipSize} available.`);
      return;
    }
    
    const newBoard = playerBoard.map((r) => r.slice());
    const allowed = canPlaceShip(newBoard, row, col, shipSize, orientation);
    if (!allowed) {
      setStatusMessage('Cannot place ship here.');
      return;
    }
    
    const shipPositions = [];
    
    if (orientation === 'horizontal') {
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
    
    const newPlacedShips = [...placedShips, {
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
  };

  // Funkcje obsługi drag and drop
  const handleDragStart = (shipSize) => {
    setDraggedShip({ size: shipSize });
    setDidDrop(false);
  };

  const handleDragEnd = () => {
    if (dragRestore && !didDrop) {
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
    setDraggedShip(null);
    setHoverCell(null);
    setDidDrop(false);
  };

  const handleDragOver = (e, row, col) => {
    e.preventDefault();
    if (!isPlacingShips || !draggedShip) return;
    setHoverCell({ row, col });
  };

  const handleDragLeave = () => {
    setHoverCell(null);
  };

  const handleDrop = (e, row, col) => {
    e.preventDefault();
    if (draggedShip && isPlacingShips) {
      placeShip(row, col, draggedShip.size);
      setDidDrop(true);
    }
    setDraggedShip(null);
    setHoverCell(null);
  };

  const isPreviewCell = (row, col) => {
    if (!hoverCell || !draggedShip) return false;

    if (orientation === 'horizontal') {
      return row === hoverCell.row && col >= hoverCell.col && col < hoverCell.col + draggedShip.size;
    }
    return col === hoverCell.col && row >= hoverCell.row && row < hoverCell.row + draggedShip.size;
  };

  const isValidPreview = () => {
    if (!hoverCell || !draggedShip) return false;
    return canPlaceShip(playerBoard, hoverCell.row, hoverCell.col, draggedShip.size, orientation);
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
    setPlayerBoard(newBoard);
    setPlacedShips(newPlacedShips);
    setDraggedShip({ size: ship.size });
    setDidDrop(false);

    if (gameId) {
      localStorage.setItem(`game_${gameId}_ships`, JSON.stringify({
        board: newBoard,
        ships: newPlacedShips
      }));
    }
  };

  // Funkcja obrotu klikniętego statku
  const handleShipClick = (row, col) => {
    if (!isPlacingShips) return;
    const ship = getShipAtCell(row, col);
    if (!ship) return;

    // Usuwamy statek z planszy
    const newPlacedShips = placedShips.filter((s) => s !== ship);
    const newBoard = createEmptyBoard();
    newPlacedShips.forEach((s) => {
      s.positions.forEach((pos) => {
        newBoard[pos.x][pos.y] = CELL_TYPES.SHIP;
      });
    });

    // Zmieniamy orientację
    const newOrientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
    setOrientation(newOrientation);

    // Próbujemy umieścić statek z nową orientacją
    // Znajdujemy górny-lewy róg statku
    const positions = ship.positions.sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
    const startRow = positions[0].x;
    const startCol = positions[0].y;

    // Sprawdzamy czy można umieścić z nową orientacją
    if (canPlaceShip(newBoard, startRow, startCol, ship.size, newOrientation)) {
      // Umieszczamy statek z nową orientacją
      const shipPositions = [];
      if (newOrientation === 'horizontal') {
        for (let c = startCol; c < startCol + ship.size; c += 1) {
          newBoard[startRow][c] = CELL_TYPES.SHIP;
          shipPositions.push({ x: startRow, y: c });
        }
      } else {
        for (let r = startRow; r < startRow + ship.size; r += 1) {
          newBoard[r][startCol] = CELL_TYPES.SHIP;
          shipPositions.push({ x: r, y: startCol });
        }
      }

      const updatedShips = [...newPlacedShips, { size: ship.size, positions: shipPositions }];
      setPlayerBoard(newBoard);
      setPlacedShips(updatedShips);
      
      if (gameId) {
        localStorage.setItem(`game_${gameId}_ships`, JSON.stringify({
          board: newBoard,
          ships: updatedShips
        }));
      }
      setStatusMessage(`Ship rotated to ${newOrientation}.`);
    } else {
      // Nie można obracać, przywracamy poprzedni stan
      setStatusMessage('Cannot rotate ship here.');
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
      await axios.post(
        `${API_BASE_URL}/games/${gameId}/forfeit/`,
        {},
        { withCredentials: true }
      );
      
      setGameResult('lose');
      setRedirectCountdown(3);
      setStatusMessage('Game forfeited. You lose!');
    } catch (err) {
      setStatusMessage(err.response?.data?.error || 'Error forfeiting game. Please try again.');
      setShowForfeitConfirm(false);
    }
  };

  // Funkcja losowego rozmieszczenia statków
  const randomizeShips = () => {
    const newBoard = createEmptyBoard();
    const newPlacedShips = [];
    const shipSizes = [...allShips];

    // Tasujemy orientacje dla każdego statku
    for (const size of shipSizes) {
      let placed = false;
      let attempts = 0;
      
      while (!placed && attempts < 100) {
        const randomRow = Math.floor(Math.random() * BOARD_SIZE);
        const randomCol = Math.floor(Math.random() * BOARD_SIZE);
        const randomOrientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

        if (canPlaceShip(newBoard, randomRow, randomCol, size, randomOrientation)) {
          const shipPositions = [];
          
          if (randomOrientation === 'horizontal') {
            for (let c = randomCol; c < randomCol + size; c += 1) {
              newBoard[randomRow][c] = CELL_TYPES.SHIP;
              shipPositions.push({ x: randomRow, y: c });
            }
          } else {
            for (let r = randomRow; r < randomRow + size; r += 1) {
              newBoard[r][randomCol] = CELL_TYPES.SHIP;
              shipPositions.push({ x: r, y: randomCol });
            }
          }

          newPlacedShips.push({
            size: size,
            positions: shipPositions
          });
          placed = true;
        }
        attempts++;
      }
    }

    setPlayerBoard(newBoard);
    setPlacedShips(newPlacedShips);
    setStatusMessage('Ships placed randomly! Click "Start Game" to begin.');
    
    if (gameId) {
      localStorage.setItem(`game_${gameId}_ships`, JSON.stringify({
        board: newBoard,
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
    
    if (!gameId) {
      setStatusMessage('Game not ready.');
      return;
    }
    
    // Kopiujemy planszę przeciwnika.
    const newEnemyBoard = enemyBoard.map((r) => r.slice());
    // Jeśli pole już było strzelane, nie robimy nic.
    if (newEnemyBoard[row][col] === CELL_TYPES.HIT || newEnemyBoard[row][col] === CELL_TYPES.MISS) {
      setStatusMessage('You already shot here.');
      return;
    }
    
    try {
      // Wysyłamy strzał do backendu przez WebSocket (do zaimplementowania później)
      // Na razie oznaczamy jako MISS tymczasowo
      newEnemyBoard[row][col] = CELL_TYPES.MISS;
      setEnemyBoard(newEnemyBoard);
      setStatusMessage(`Shot fired at ${row + 1}, ${col + 1}. Waiting for AI response...`);
      
      // TODO: Implementacja WebSocket do komunikacji z backendem
      // WebSocket będzie obsługiwał strzały i odpowiedzi AI
      
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
      setStatusMessage('Game started! Your turn - shoot on enemy board.');
    } catch (err) {
      setStatusMessage(err.response?.data?.error || 'Error placing ships. Please try again.');
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

    if (cellType === CELL_TYPES.SHIP) return `${base} bg-emerald-500`;
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
            <p className="text-slate-300 mb-4">Redirecting to menu in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}...</p>
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
                      onDragStart={() => handleDragStart(size)}
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
            <div
              className="grid gap-0"
              style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}
            >
            {/* Renderujemy wiersze */}
            {playerBoard.map((row, rowIdx) => (
              // Renderujemy kolumny w danym wierszu.
              row.map((cell, colIdx) => (
                // Pojedyncze pole planszy gracza.
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
              ))
            ))}
            </div>
          </div>
        </div>

        {/* Plansza przeciwnika */}
        <div className="bg-slate-800/60 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Enemy Board</h2>
          {/* Siatka planszy przeciwnika */}
          <div className="w-full max-w-md mx-auto">
            <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)` }}>
            {/* Renderujemy wiersze */}
            {enemyBoard.map((row, rowIdx) => (
              // Renderujemy kolumny w danym wierszu.
              row.map((cell, colIdx) => (
                // Pojedyncze pole planszy przeciwnika.
                <div
                  key={`e-${rowIdx}-${colIdx}`}
                  className={getCellClass(cell, true)}
                  onClick={() => handleEnemyCellClick(rowIdx, colIdx)}
                />
              ))
            ))}
            </div>
          </div>
        </div>
      </div>
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
