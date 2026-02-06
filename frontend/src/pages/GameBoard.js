// Importujemy React i hook useState do zarządzania stanem komponentu.
import React, { useState } from 'react';
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
function Body({ onNavigate }) {
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
    // Kopiujemy planszę przeciwnika.
    const newEnemyBoard = enemyBoard.map((r) => r.slice());
    // Jeśli pole już było strzelane, nie robimy nic.
    if (newEnemyBoard[row][col] === CELL_TYPES.HIT || newEnemyBoard[row][col] === CELL_TYPES.MISS) {
      setStatusMessage('You already shot here.');
      return;
    }
    // Tymczasowo oznaczamy strzał jako MISS (logika trafienia będzie z backendu).
    newEnemyBoard[row][col] = CELL_TYPES.MISS;
    // Aktualizujemy stan planszy przeciwnika.
    setEnemyBoard(newEnemyBoard);
    // Ustawiamy komunikat.
    setStatusMessage(`Shot fired at ${row + 1}, ${col + 1}.`);
  };

  // Funkcja kończąca rozmieszczanie statków.
  const finishPlacement = () => {
    // Przechodzimy do fazy strzelania.
    setIsPlacingShips(false);
    // Aktualizujemy komunikat.
    setStatusMessage('Game started! Shoot on enemy board.');
  };

  // Funkcja zmieniająca orientację statku.
  const toggleOrientation = () => {
    // Przełączamy między horizontal i vertical.
    setOrientation((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
  };

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
            disabled={!isPlacingShips}
          >
            {/* Tekst przycisku zakończenia */}
            Start Game
          </button>
        </div>
      </div>

      {/* Sekcja plansz */}
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
    </div>
  );
}

// Główny komponent GameBoard.
function GameBoard({ onNavigate }) {
  return (
    <Template>
      <Body onNavigate={onNavigate} />
    </Template>
  );
}

// Eksportujemy komponent GameBoard jako domyślny.
export default GameBoard;
