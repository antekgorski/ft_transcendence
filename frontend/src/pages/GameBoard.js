// Importujemy React i hooki useState oraz useEffect do zarządzania stanem komponentu.
import React, { useState, useEffect } from 'react';
import gameApi from '../services/gameApi';
import { Template } from './Components';

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
function Body({ userData, onLogout, onNavigate }) {
  // Stan planszy gracza (własne statki).
  const [playerBoard, setPlayerBoard] = useState(createEmptyBoard);
  // Stan planszy przeciwnika (gdzie oddajemy strzały).
  const [enemyBoard, setEnemyBoard] = useState(createEmptyBoard);
  // Stan określający, czy jesteśmy w trybie rozmieszczania statków.
  const [isPlacingShips, setIsPlacingShips] = useState(true);
  // Stan z informacją o aktualnie wybranym typie statku (długość).
  const [selectedShipSize, setSelectedShipSize] = useState(4);
  // Stan z informacją o orientacji statku.
  const [orientation, setOrientation] = useState('horizontal');
  // Stan komunikatu dla użytkownika.
  const [statusMessage, setStatusMessage] = useState('Place your ships on your board.');
  // Stan przechowujący ID gry z backendu.
  const [gameId, setGameId] = useState(null);
  // Stan przechowujący typ gry (pvp lub ai).
  const [gameType, setGameType] = useState(null);
  // Stan określający fazę gry.
  const [gamePhase, setGamePhase] = useState('lobby');
  // Stan określający czy to moja tura.
  const [isMyTurn, setIsMyTurn] = useState(false);
  // Stan przechowujący ID przeciwnika.
  const [opponentId, setOpponentId] = useState(null);
  // Stan przechowujący instancję WebSocket.
  const [websocket, setWebsocket] = useState(null);
  // Stan informujący czy statki zostały rozstawione przez graczy.
  const [shipsPlaced, setShipsPlaced] = useState({ player1: false, player2: false });
  // Stan przechowujący dane o rozmieszczonych statkach.
  const [placedShipsData, setPlacedShipsData] = useState([]);
  // Stan przechowujący ID obecnego gracza (nas).
  const [currentUserId, setCurrentUserId] = useState(null);
  // Stan przechowujący ID player_1 z gry.
  const [player1Id, setPlayer1Id] = useState(null);
  // Stan przechowujący ID player_2 z gry.
  const [player2Id, setPlayer2Id] = useState(null);
  // Statystyki strzałów i trafień (dla endGame).
  const [player1Shots, setPlayer1Shots] = useState(0);
  const [player1Hits, setPlayer1Hits] = useState(0);
  const [player2Shots, setPlayer2Shots] = useState(0);
  const [player2Hits, setPlayer2Hits] = useState(0);

  // Efekt do pobierania ID obecnego użytkownika z userData
  useEffect(() => {
    if (userData && userData.id) {
      setCurrentUserId(userData.id);
    }
  }, [userData]);

  // Lista dostępnych statków (długości) do rozmieszczenia.
  const availableShips = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];
  // Konfiguracja statków z nazwą i rozmiarem (do walidacji i UI).
  const SHIP_CONFIGS = [
    // Jeden statek długości 4.
    { id: 'battleship', size: 4, label: 'Battleship (4)' },
    // Dwa statki długości 3.
    { id: 'cruiser-1', size: 3, label: 'Cruiser (3)' },
    { id: 'cruiser-2', size: 3, label: 'Cruiser (3)' },
    // Trzy statki długości 2.
    { id: 'destroyer-1', size: 2, label: 'Destroyer (2)' },
    { id: 'destroyer-2', size: 2, label: 'Destroyer (2)' },
    { id: 'destroyer-3', size: 2, label: 'Destroyer (2)' },
    // Cztery statki długości 1.
    { id: 'submarine-1', size: 1, label: 'Submarine (1)' },
    { id: 'submarine-2', size: 1, label: 'Submarine (1)' },
    { id: 'submarine-3', size: 1, label: 'Submarine (1)' },
    { id: 'submarine-4', size: 1, label: 'Submarine (1)' },
  ];
  // Łączna liczba pól statków (do wykrycia końca gry).
  const totalShipCells = SHIP_CONFIGS.reduce((sum, ship) => sum + ship.size, 0);

  // Funkcja licząca ile statków danego rozmiaru zostało już rozstawionych.
  const countPlacedShipsBySize = (size) => {
    // Filtrujemy placedShipsData po rozmiarze statku.
    return placedShipsData.filter((ship) => ship.size === size).length;
  };

  // Funkcja sprawdzająca czy można jeszcze rozstawić statek danego rozmiaru.
  const canPlaceMoreShipsOfSize = (size) => {
    // Liczymy ile statków danego rozmiaru jest w konfiguracji.
    const totalAllowed = SHIP_CONFIGS.filter((ship) => ship.size === size).length;
    // Liczymy ile już rozstawiono.
    const alreadyPlaced = countPlacedShipsBySize(size);
    // Zwracamy true jeśli można jeszcze dodać.
    return alreadyPlaced < totalAllowed;
  };

  // Funkcja sprawdzająca czy wszystkie statki zostały rozstawione.
  const areAllShipsPlaced = () => {
    // Liczymy ile statków powinno być łącznie.
    const totalShips = SHIP_CONFIGS.length;
    // Liczymy ile statków już rozstawiono.
    const placedShips = placedShipsData.length;
    // Zwracamy true jeśli liczby się zgadzają.
    return placedShips === totalShips;
  };

  // Funkcja sprawdzająca, czy statek może zostać ustawiony w danym miejscu.
  const canPlaceShip = (board, row, col, size, dir) => {
    // Jeśli orientacja jest pozioma.
    if (dir === 'horizontal') {
      // Sprawdzamy czy statek nie wyjdzie poza planszę.
      if (col + size > BOARD_SIZE) return false;
      // Iterujemy po długości statku.
      for (let c = col; c < col + size; c += 1) {
        // Jeśli pole nie jest puste, nie możemy postawić statku.
        if (board[row][c] !== CELL_TYPES.EMPTY) return false;
      }
    } else {
      // Dla orientacji pionowej sprawdzamy granice planszy.
      if (row + size > BOARD_SIZE) return false;
      // Iterujemy po długości statku w dół.
      for (let r = row; r < row + size; r += 1) {
        // Jeśli pole nie jest puste, nie możemy postawić statku.
        if (board[r][col] !== CELL_TYPES.EMPTY) return false;
      }
    }
    // Jeśli wszystkie warunki spełnione, zwracamy true.
    return true;
  };

  // Funkcja umieszczająca statek na planszy gracza.
  const placeShip = (row, col) => {
    // Sprawdzamy czy możemy jeszcze rozstawić statek tego rozmiaru.
    if (!canPlaceMoreShipsOfSize(selectedShipSize)) {
      // Jeśli limit osiągnięty, ustawiamy komunikat i kończymy.
      setStatusMessage(`No more ships of size ${selectedShipSize} available.`);
      return;
    }
    // Tworzymy kopię planszy, aby nie modyfikować stanu bezpośrednio.
    const newBoard = playerBoard.map((r) => r.slice());
    // Sprawdzamy czy można umieścić statek.
    const allowed = canPlaceShip(newBoard, row, col, selectedShipSize, orientation);
    // Jeśli nie można, pokazujemy komunikat i kończymy.
    if (!allowed) {
      setStatusMessage('Cannot place ship here.');
      return;
    }
    // Przygotowujemy listę komórek statku do zapisania w state.
    const shipCells = [];
    // Jeśli orientacja pozioma, wypełniamy odpowiednie pola.
    if (orientation === 'horizontal') {
      // Iterujemy po długości statku.
      for (let c = col; c < col + selectedShipSize; c += 1) {
        // Ustawiamy pole jako SHIP.
        newBoard[row][c] = CELL_TYPES.SHIP;
        // Dodajemy komórkę statku do listy.
        shipCells.push([row, c]);
      }
    } else {
      // Dla orientacji pionowej wypełniamy pola w dół.
      for (let r = row; r < row + selectedShipSize; r += 1) {
        // Ustawiamy pole jako SHIP.
        newBoard[r][col] = CELL_TYPES.SHIP;
        // Dodajemy komórkę statku do listy.
        shipCells.push([r, col]);
      }
    }
    // Dodajemy dane statku do listy rozstawionych statków.
    setPlacedShipsData((prev) => [
      ...prev,
      {
        // Rozmiar statku.
        size: selectedShipSize,
        // Komórki zajmowane przez statek.
        cells: shipCells,
        // Orientacja statku.
        orientation,
      },
    ]);
    // Aktualizujemy stan planszy gracza.
    setPlayerBoard(newBoard);
    // Aktualizujemy status.
    setStatusMessage('Ship placed.');
  };

  // Funkcja obsługująca kliknięcie pola na planszy gracza.
  const handlePlayerCellClick = (row, col) => {
    // Jeśli jesteśmy w trybie rozmieszczania, stawiamy statek.
    if (isPlacingShips) {
      placeShip(row, col);
    }
  };

  // Funkcja obsługująca kliknięcie pola na planszy przeciwnika.
  const handleEnemyCellClick = (row, col) => {
    // Jeśli nadal rozmieszczamy statki, nie można strzelać.
    if (isPlacingShips) {
      setStatusMessage('Finish placing ships before shooting.');
      return;
    }

    // Jeśli nie jest nasza tura, nie można strzelać.
    if (!isMyTurn) {
      setStatusMessage('Wait for your turn to shoot.');
      return;
    }

    // Kopiujemy planszę przeciwnika.
    const newEnemyBoard = enemyBoard.map((r) => r.slice());
    
    // Jeśli pole już było strzelane, nie robimy nic.
    if (newEnemyBoard[row][col] === CELL_TYPES.HIT || newEnemyBoard[row][col] === CELL_TYPES.MISS) {
      setStatusMessage('You already shot here.');
      return;
    }

    // Sprawdzamy czy WebSocket jest połączony
    if (!gameApi.isConnected()) {
      setStatusMessage('WebSocket not connected. Cannot shoot.');
      return;
    }

    try {
      // Wysyłamy strzał do backendu
      gameApi.shootAt(row, col);
      
      // Tymczasowo oznaczamy strzał jako MISS (wkrótce zostanie aktualizowany z backendu)
      newEnemyBoard[row][col] = CELL_TYPES.MISS;
      setEnemyBoard(newEnemyBoard);
      
      // Ustawiamy komunikat.
      setStatusMessage(`Shot fired at ${row + 1}, ${col + 1}. Waiting for result...`);
      
      // Ustawiamy że czekamy na wynik
      setIsMyTurn(false);
    } catch (error) {
      console.error('Error sending shot:', error);
      setStatusMessage(`Error sending shot: ${error.message}`);
    }
  };

  // Funkcja wysyłająca statki do backendu.
  const placeShipsOnBackend = async () => {
    try {
      // Ustawiamy status.
      setStatusMessage('Sending ships to server...');
      
      // Sprawdzamy czy mamy dane statków
      if (!placedShipsData || placedShipsData.length === 0) {
        setStatusMessage('No ships to place. Please place ships first.');
        return;
      }

      // Wysyłamy statki do backendu.
      const response = await gameApi.placeShips(gameId, placedShipsData);
      console.log('Ships placed successfully:', response);

      // Kończymy fazę rozmieszczania.
      setIsPlacingShips(false);
      
      // Podłączamy do WebSocket aby odebrać updaty z backendu
      try {
        console.log('Connecting to WebSocket for game:', gameId);
        await gameApi.connectWebSocket(gameId);
        console.log('WebSocket connected successfully');
      } catch (wsError) {
        console.error('WebSocket connection failed:', wsError);
        setStatusMessage('WebSocket connection failed. Game updates may be delayed.');
      }

      // Przechodzimy do fazy oczekiwania.
      setGamePhase('waiting');
      
      // Aktualizujemy status.
      if (gameType === 'ai') {
        // Dla gry z AI, przeciwnik (AI) powinien być zawsze gotowy
        setStatusMessage('AI opponent ready. Starting game...');
        setGamePhase('playing');
      } else {
        setStatusMessage('Waiting for opponent to place ships...');
      }
    } catch (error) {
      // Obsługujemy błąd.
      console.error('Error placing ships:', error);
      setStatusMessage(`Failed to place ships: ${error.message}`);
      // Re-enable ship placement na wypadek błędu
      setIsPlacingShips(true);
    }
  };

  // Funkcja kończąca rozmieszczanie statków.
  const finishPlacement = () => {
    // Sprawdzamy czy wszystkie statki zostały rozstawione.
    if (!areAllShipsPlaced()) {
      // Jeśli nie, ustawiamy komunikat i nie przechodzimy dalej.
      setStatusMessage('Place all ships before starting the game.');
      return;
    }
    // Sprawdzamy czy gra została utworzona.
    if (!gameId) {
      // Jeśli nie, prosimy o stworzenie gry.
      setStatusMessage('Create a game first.');
      return;
    }
    // Wysyłamy statki do backendu.
    placeShipsOnBackend();
  };

  // Funkcja do poddania się grze.
  const handleForfeit = async () => {
    // Potwierdzenie
    if (!window.confirm('Are you sure you want to forfeit the game?')) {
      return;
    }

    try {
      // Sprawdzamy czy WebSocket jest połączony
      if (!gameApi.isConnected()) {
        // Fallback - użyjemy REST API
        console.log('WebSocket not connected, using REST API for forfeit');
        const result = await gameApi.forfeitGame(gameId);
        console.log('Game forfeited via REST API:', result);
      } else {
        // Wysyłamy forfeit przez WebSocket
        gameApi.forfeit();
      }

      setStatusMessage('You have forfeited the game.');
      setGamePhase('end');
    } catch (error) {
      console.error('Error forfeiting game:', error);
      setStatusMessage(`Error forfeiting game: ${error.message}`);
    }
  };

  // Funkcja kończąca grę i zapisująca wynik.
  const handleEndGame = async (winnerId, reason = 'all_ships_sunk') => {
    if (!gameId) {
      return;
    }

    try {
      await gameApi.endGame(gameId, {
        winnerId,
        player1Shots,
        player1Hits,
        player2Shots,
        player2Hits,
        reason,
      });

      setGamePhase('end');
      if (winnerId === currentUserId) {
        setStatusMessage('You win! All enemy ships were sunk.');
      } else {
        setStatusMessage('You lost. All your ships were sunk.');
      }
    } catch (error) {
      console.error('Error ending game:', error);
      setStatusMessage(`Failed to end game: ${error.message}`);
    }
  };

  // Funkcja zmieniająca orientację statku.
  const toggleOrientation = () => {
    // Przełączamy między horizontal i vertical.
    setOrientation((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
  };

  // Funkcja tworząca nową grę przez backend.
  const handleCreateGame = async () => {
    try {
      // Sprawdzamy czy wybrano tryb gry.
      if (!gameType) {
        setStatusMessage('Select game mode first.');
        return;
      }

      // Jeśli PvP, sprawdzamy czy podano ID przeciwnika.
      if (gameType === 'pvp' && !opponentId) {
        setStatusMessage('Provide opponent ID for PvP.');
        return;
      }

      // Wywołujemy backend, aby stworzyć grę.
      const game = await gameApi.createGame(gameType, opponentId);

      // Zapisujemy ID gry.
      setGameId(game.id);
      // Zapisujemy typ gry.
      setGameType(game.game_type);
      // Zapisujemy IDs graczy
      setPlayer1Id(game.player_1);
      setPlayer2Id(game.player_2);
      // Ustawiamy fazę gry na rozmieszczanie statków.
      setGamePhase('placing');
      // Aktualizujemy status.
      setStatusMessage('Game created. Place your ships.');
    } catch (error) {
      // Obsługujemy błąd tworzenia gry.
      setStatusMessage(`Failed to create game: ${error.message}`);
    }
  };

  // Efekt sprawdzający status rozmieszczenia statków u obu graczy.
  useEffect(() => {
    // Jeśli nie jesteśmy w fazie oczekiwania albo brak gameId, nie uruchamiamy pollingu.
    if (gamePhase !== 'waiting' || !gameId) {
      return undefined;
    }

    // Funkcja do pobrania statusu z backendu.
    const fetchShipsStatus = async () => {
      try {
        // Pobieramy status z backendu.
        const status = await gameApi.checkShipsStatus(gameId);
        // Aktualizujemy stan informacji o rozstawieniu statków.
        setShipsPlaced({
          player1: status.player_1_ready,
          player2: status.player_2_ready,
        });

        // Sprawdzamy czy obaj gracze są gotowi.
        const bothReady = status.both_ready || (gameType === 'ai' && status.player_1_ready);

        // Jeśli obaj gotowi, przechodzimy do fazy gry.
        if (bothReady) {
          setGamePhase('playing');
          setStatusMessage('Game started! Shoot on enemy board.');
        }
      } catch (error) {
        // Obsługujemy błąd pobierania statusu.
        setStatusMessage(`Failed to check ships status: ${error.message}`);
      }
    };

    // Uruchamiamy pierwszy fetch natychmiast.
    fetchShipsStatus();

    // Ustawiamy polling co 2 sekundy.
    const intervalId = setInterval(fetchShipsStatus, 2000);

    // Czyścimy interval przy odmontowaniu lub zmianie zależności.
    return () => clearInterval(intervalId);
  }, [gamePhase, gameId, gameType]);

  // Efekt do cleanup WebSocket przy unmount komponentu
  useEffect(() => {
    // Cleanup function - zamykamy WebSocket przy opuszczeniu komponentu
    return () => {
      if (gameApi.isConnected()) {
        console.log('Component unmounting - disconnecting WebSocket');
        gameApi.disconnectWebSocket();
      }
    };
  }, []);

  // Efekt do rejestracji handlerów WebSocket
  useEffect(() => {
    // Tylko jeśli WebSocket jest podłączony
    if (!gameApi.isConnected()) {
      return;
    }

    // Handler dla wiadomości game_move
    // Ta wiadomość oznacza że gracz oddał strzał (mój lub przeciwnika)
    const unsubscribeGameMove = gameApi.on('game_move', (data) => {
      console.log('Received game_move (opponent is shooting at us):', data);
      
      // data = {
      //   type: 'game_move',
      //   player_id: 'opponent_uuid',
      //   move_type: 'shoot',
      //   data: { row: X, col: Y }
      // }
      
      // To wiadomość że przeciwnik nas atakuje
      if (data.move_type === 'shoot') {
        const { row, col } = data.data || {};

        if (row === undefined || col === undefined) {
          return;
        }

        // Pokazujemy komunikat że zostaliśmy zaatakowani
        setStatusMessage(`⚔️ OPPONENT ATTACKS at row ${row + 1}, col ${col + 1}!`);

        const isCurrentUserPlayer1 = currentUserId && player1Id && currentUserId === player1Id;
        const opponentHits = isCurrentUserPlayer1 ? player2Hits : player1Hits;
        const opponentId = isCurrentUserPlayer1 ? player2Id : player1Id;

        setPlayerBoard((prevBoard) => {
          const nextBoard = prevBoard.map((r) => r.slice());
          const currentCell = nextBoard[row][col];
          const wasAlreadyShot = currentCell === CELL_TYPES.HIT || currentCell === CELL_TYPES.MISS;

          if (wasAlreadyShot) {
            return prevBoard;
          }

          const isHit = currentCell === CELL_TYPES.SHIP;
          nextBoard[row][col] = isHit ? CELL_TYPES.HIT : CELL_TYPES.MISS;

          if (isCurrentUserPlayer1) {
            setPlayer2Shots((prev) => prev + 1);
            if (isHit) setPlayer2Hits((prev) => prev + 1);
          } else if (currentUserId && player2Id) {
            setPlayer1Shots((prev) => prev + 1);
            if (isHit) setPlayer1Hits((prev) => prev + 1);
          }

          const opponentHitsAfter = opponentHits + (isHit ? 1 : 0);
          if (isHit && opponentHitsAfter >= totalShipCells && opponentId && gamePhase === 'playing') {
            handleEndGame(opponentId);
          }

          return nextBoard;
        });
      }
    });

    // Handler dla wiadomości z rezultatem strzału
    // Backend wysyła to aby poinformować gracza czy jego strzał trafił
    const unsubscribeGameMoveResult = gameApi.on('game_move_result', (data) => {
      console.log('Received game_move_result:', data);
      
      // data = {
      //   type: 'game_move_result',
      //   row: X,
      //   col: Y,
      //   result: 'hit' | 'miss' | 'sunk',
      //   ship_sunk: true/false (jeśli hit),
      //   player_turn_now: 'player_1_id' | 'player_2_id'
      // }
      
      const { row, col, result, ship_sunk } = data;

      const isHit = result === 'hit';
      const isCurrentUserPlayer1 = currentUserId && player1Id && currentUserId === player1Id;
      const myHits = isCurrentUserPlayer1 ? player1Hits : player2Hits;

      // Aktualizujemy planszę przeciwnika na podstawie rezultatu
      if (row !== undefined && col !== undefined) {
        setEnemyBoard((prevBoard) => {
          const newEnemyBoard = prevBoard.map((r) => r.slice());

          if (result === 'hit') {
            newEnemyBoard[row][col] = CELL_TYPES.HIT;
            if (ship_sunk) {
              setStatusMessage(`🎯 HIT AND SUNK at row ${row + 1}, col ${col + 1}! Great shot!`);
            } else {
              setStatusMessage(`🎯 HIT at row ${row + 1}, col ${col + 1}!`);
            }
          } else if (result === 'miss') {
            newEnemyBoard[row][col] = CELL_TYPES.MISS;
            setStatusMessage(`❌ MISS at row ${row + 1}, col ${col + 1}. Better luck next time!`);
          }

          return newEnemyBoard;
        });
      }

      if (isCurrentUserPlayer1) {
        setPlayer1Shots((prev) => prev + 1);
        if (isHit) setPlayer1Hits((prev) => prev + 1);
      } else if (currentUserId && player2Id) {
        setPlayer2Shots((prev) => prev + 1);
        if (isHit) setPlayer2Hits((prev) => prev + 1);
      }

      const myHitsAfter = myHits + (isHit ? 1 : 0);
      if (isHit && myHitsAfter >= totalShipCells && gamePhase === 'playing') {
        handleEndGame(currentUserId);
      }
      
      // Aktualizujemy turę - jeśli `player_turn_now` jest naszym ID, to nasza tura
      // TODO w następnej fazie: zaimplementować logikę turn_changed
    });

    // Handler dla turn_changed
    const unsubscribeTurnChanged = gameApi.on('turn_changed', (data) => {
      console.log('Received turn_changed:', data);
      
      // data = {
      //   type: 'turn_changed',
      //   current_player_id: 'uuid'
      // }
      
      const { current_player_id } = data;
      
      // Sprawdzamy czy to nasza tura
      const myTurn = current_player_id === currentUserId;
      setIsMyTurn(myTurn);
      
      // Ustawiamy komunikat
      if (myTurn) {
        setStatusMessage('Your turn! Click enemy board to shoot.');
      } else {
        setStatusMessage('Opponent\'s turn. Waiting for their move...');
      }
    });

    // Handler dla game_forfeit
    const unsubscribeGameForfeit = gameApi.on('game_forfeit', (data) => {
      console.log('Opponent forfeited:', data);
      setStatusMessage('Opponent has forfeited! You win!');
      setGamePhase('end');
    });

    // Handler dla game_ended
    const unsubscribeGameEnded = gameApi.on('game_ended', (data) => {
      console.log('Game ended:', data);
      const { winner_id, reason } = data;
      setGamePhase('end');
      setStatusMessage(`Game ended: ${reason}. Winner: ${winner_id}`);
    });

    // Handler dla error
    const unsubscribeError = gameApi.on('error', (data) => {
      console.error('WebSocket error:', data);
      setStatusMessage(`Server error: ${data.message}`);
    });

    // Cleanup - unsubscribe ze wszystkich handlerów
    return () => {
      unsubscribeGameMove();
      unsubscribeGameMoveResult();
      unsubscribeTurnChanged();
      unsubscribeGameForfeit();
      unsubscribeGameEnded();
      unsubscribeError();
    };
  }, [
    gameApi,
    currentUserId,
    gamePhase,
    player1Hits,
    player1Id,
    player1Shots,
    player2Hits,
    player2Id,
    player2Shots,
    totalShipCells,
  ]);

  // Funkcja zwracająca klasę Tailwind dla danego typu pola.
  const getCellClass = (cellType, isEnemy) => {
    // Klasy bazowe dla wszystkich pól.
    const base = 'w-8 h-8 sm:w-10 sm:h-10 border border-slate-700 flex items-center justify-center';
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

  // Render komponentu Body.
  return (
    // Główny kontener strony.
    <div className="text-white">
      {/* Przycisk powrotu do menu */}
      <div className="mb-4">
        <button
          onClick={() => onNavigate('router')}
          className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-md font-semibold transition-colors"
        >
          ← Back to Menu
        </button>
      </div>

      {/* Tytuł strony */}
      <h1 className="text-3xl font-bold text-center mb-6">Battleship — Game Board</h1>
      
        {/* Sekcja lobby - wybór trybu gry */}
        {gamePhase === 'lobby' && (
          // Kontener lobby.
          <div className="max-w-3xl mx-auto mb-6 bg-slate-800/60 p-4 rounded-lg">
            {/* Nagłówek lobby */}
            <h2 className="text-xl font-semibold mb-3">Choose Game Mode</h2>

            {/* Opis */}
            <p className="text-slate-300 mb-4">
              Select how you want to play. You can start a match against AI or challenge a friend.
            </p>

            {/* Przyciski wyboru trybu */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Przycisk gry z AI */}
              <button
                className={`px-4 py-2 rounded ${gameType === 'ai' ? 'bg-emerald-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                onClick={() => {
                  // Ustawiamy typ gry na AI.
                  setGameType('ai');
                  // Ustawiamy komunikat statusu.
                  setStatusMessage('AI mode selected.');
                }}
              >
                Play vs AI
              </button>

              {/* Przycisk gry PvP */}
              <button
                className={`px-4 py-2 rounded ${gameType === 'pvp' ? 'bg-emerald-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                onClick={() => {
                  // Ustawiamy typ gry na PvP.
                  setGameType('pvp');
                  // Ustawiamy komunikat statusu.
                  setStatusMessage('PvP mode selected.');
                }}
              >
                Play vs Friend
              </button>
            </div>

            {/* Pole na ID przeciwnika (tylko PvP) */}
            {gameType === 'pvp' && (
              // Kontener inputu.
              <div className="mt-4">
                {/* Label */}
                <label className="block text-sm text-slate-300 mb-1">Opponent ID</label>
                {/* Input */}
                <input
                  type="text"
                  value={opponentId || ''}
                  onChange={(e) => {
                    // Ustawiamy ID przeciwnika.
                    setOpponentId(e.target.value);
                  }}
                  placeholder="Paste opponent UUID here"
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-white"
                />
              </div>
            )}

            {/* Przycisk rozpoczęcia gry */}
            <div className="mt-4">
              <button
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500"
                onClick={handleCreateGame}
              >
                Create Game
              </button>
            </div>
          </div>
        )}

      {/* Sekcja czekania na gracza */}
      {gamePhase === 'waiting' && (
        <div className="max-w-3xl mx-auto mb-6 bg-slate-800/60 p-4 rounded-lg text-center">
          <h2 className="text-xl font-semibold mb-3">Waiting for Opponent</h2>
          <p className="text-slate-300 mb-4">
            {gameType === 'ai' 
              ? 'AI opponent is placing ships...' 
              : 'Waiting for your opponent to place their ships...'}
          </p>
          <div className="flex justify-center gap-2 mb-4">
            <div className="animate-spin h-6 w-6 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
            <span className="text-slate-300">Ships placed: {shipsPlaced.player1 ? '✓' : '✗'} (You) / {shipsPlaced.player2 ? '✓' : '✗'} (Opponent)</span>
          </div>
        </div>
      )}

      {/* Sekcja informacji o grze podczas gry */}
      {gamePhase === 'playing' && (
        <div className="max-w-3xl mx-auto mb-6 bg-slate-800/60 p-4 rounded-lg">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-slate-400 text-sm">Game Status</p>
              <p className="text-lg font-semibold text-emerald-400">Active</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Current Turn</p>
              <p className={`text-lg font-semibold ${isMyTurn ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {isMyTurn ? 'Your Turn' : 'Opponent\'s Turn'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Game Type</p>
              <p className="text-lg font-semibold text-blue-400">{gameType === 'ai' ? 'vs AI' : 'vs Friend'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Sekcja końca gry */}
      {gamePhase === 'end' && (
        <div className="max-w-3xl mx-auto mb-6 bg-slate-800/60 p-4 rounded-lg text-center">
          <h2 className="text-2xl font-bold mb-3">Game Over!</h2>
          <p className="text-slate-300 mb-4">{statusMessage}</p>
          <button
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500"
            onClick={() => {
              setGamePhase('lobby');
              setGameId(null);
              setGameType(null);
              setPlayerBoard(createEmptyBoard());
              setEnemyBoard(createEmptyBoard());
              setIsPlacingShips(true);
              setPlacedShipsData([]);
              setStatusMessage('Place your ships on your board.');
            }}
          >
            Play Again
          </button>
        </div>
      )}

      {/* Panel sterowania */}
      <div className="max-w-5xl mx-auto mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        {/* Status gry */}
        <div className="text-slate-300">{statusMessage}</div>

        {/* Sterowanie rozmieszczaniem */}
        <div className="flex items-center gap-3">
          {/* Wybór rozmiaru statku */}
          <select
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm"
            value={selectedShipSize}
            onChange={(e) => setSelectedShipSize(Number(e.target.value))}
            disabled={!isPlacingShips}
          >
            {/* Opcje rozmiaru statku */}
            {availableShips.map((size, idx) => (
              <option key={`${size}-${idx}`} value={size}>Ship size: {size}</option>
            ))}
          </select>

          {/* Przycisk zmiany orientacji */}
          <button
            className="px-3 py-2 bg-slate-700 rounded hover:bg-slate-600"
            onClick={toggleOrientation}
            disabled={!isPlacingShips}
          >
            {/* Tekst przycisku orientacji */}
            Orientation: {orientation}
          </button>

          {/* Przycisk kończący rozmieszczanie */}
          <button
            className="px-3 py-2 bg-emerald-600 rounded hover:bg-emerald-500"
            onClick={finishPlacement}
            disabled={!isPlacingShips || !areAllShipsPlaced()}
          >
            {/* Tekst przycisku zakończenia */}
            Start Game
          </button>

          {/* Przycisk Forfeit - widoczny tylko podczas grania */}
          {gamePhase === 'playing' && (
            <button
              className="px-3 py-2 bg-red-600 rounded hover:bg-red-500"
              onClick={handleForfeit}
              title="Give up and lose the game"
            >
              Forfeit
            </button>
          )}
        </div>
      </div>

      {/* Sekcja plansz - widoczna w fazach placing i playing */}
      {(gamePhase === 'placing' || gamePhase === 'playing') && (
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Plansza gracza */}
        <div className="bg-slate-800/60 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Your Board</h2>
          {/* Siatka planszy gracza */}
          <div className="grid" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}>
            {/* Renderujemy wiersze */}
            {playerBoard.map((row, rowIdx) => (
              // Renderujemy kolumny w danym wierszu.
              row.map((cell, colIdx) => (
                // Pojedyncze pole planszy gracza.
                <div
                  key={`p-${rowIdx}-${colIdx}`}
                  className={getCellClass(cell, false)}
                  onClick={() => handlePlayerCellClick(rowIdx, colIdx)}
                />
              ))
            ))}
          </div>
        </div>

        {/* Plansza przeciwnika */}
        <div className="bg-slate-800/60 p-4 rounded-lg">
          <h2 className="text-xl font-semibold mb-3">Enemy Board</h2>
          {/* Siatka planszy przeciwnika */}
          <div className="grid" style={{ gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))` }}>
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
      )}
    </div>
  );
}

// Główny komponent GameBoard.
function GameBoard({ userData, onLogout, onNavigate }) {
  return (
    <Template>
      <Body userData={userData} onLogout={onLogout} onNavigate={onNavigate} />
    </Template>
  );
}

// Eksportujemy komponent GameBoard jako domyślny.
export default GameBoard;
