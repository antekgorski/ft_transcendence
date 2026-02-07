/**
 * Game API Service
 * 
 * Serwis do komunikacji z backend API gry.
 * Zawiera wszystkie funkcje REST do zarządzania grą (tworzenie, akceptacja, rozmieszczanie statków, itp.)
 */

import { API_BASE_URL, getAuthHeaders, getAuthToken } from '../config/api';

/**
 * Klasa GameApiService zarządza wszystkimi żądaniami do backend API i WebSocket.
 */
class GameApiService {
  /**
   * Konstruktor - inicjalizuje bazowy URL API i WebSocket.
   */
  constructor() {
    // URL do endpointów gry (backend)
    this.baseUrl = `${API_BASE_URL}/games`;
    
    // WebSocket
    this.ws = null;
    this.wsUrl = null;
    this.messageHandlers = {}; // {type: [callback1, callback2, ...]}
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000; // 3s
  }

  /**
   * Obsługuje błędy z API - wyciąga informacje o błędzie z odpowiedzi JSON.
   * @param {Response} response - Odpowiedź HTTP z backendu.
   * @returns {Promise} Promise odrzucony z komunikatem błędu.
   * @private
   */
  async _handleError(response) {
    try {
      // Próbujemy sparsować JSON z odpowiedzi
      const error = await response.json();
      // Jeśli backend zwrócił error lub error_pl, zwracamy go
      const message = error.error || error.error_pl || error.message || 'Unknown error';
      // Odrzucamy promise z komunikatem
      throw new Error(message);
    } catch (e) {
      // Jeśli JSON parsing się nie powiódł, rzucamy generyczny błąd
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * Tworzy nową grę (PvP lub AI).
   * 
   * @param {string} gameType - Typ gry: 'pvp' lub 'ai'.
   * @param {string|null} opponentId - UUID przeciwnika (dla PvP) lub null (dla AI).
   * @returns {Promise<object>} Obiekt gry z backendu.
   * @throws {Error} Błąd z backendu.
   * 
   * @example
   * const game = await gameApi.createGame('ai', null);
   * const game = await gameApi.createGame('pvp', 'opponent-uuid');
   */
  async createGame(gameType, opponentId = null) {
    try {
      // Przygotowujemy payload żądania
      const payload = {
        game_type: gameType, // 'pvp' lub 'ai'
      };

      // Dodajemy opponent_id tylko jeśli to gra PvP
      if (gameType === 'pvp' && opponentId) {
        payload.opponent_id = opponentId;
      }

      // Wysyłamy POST żądanie do backendu
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: getAuthHeaders(), // Nagłówki z tokenem JWT
        body: JSON.stringify(payload),
      });

      // Jeśli odpowiedź nie OK, obsługujemy błąd
      if (!response.ok) {
        await this._handleError(response);
      }

      // Parsujemy JSON i zwracamy grę
      const game = await response.json();
      return game;
    } catch (error) {
      // Logujemy błąd w konsoli
      console.error('Error creating game:', error);
      // Rzucamy błąd dalej (catchujemy w komponencie)
      throw error;
    }
  }

  /**
   * Pobiera aktywną grę użytkownika.
   * 
   * @returns {Promise<object>} Obiekt aktywnej gry lub 404 jeśli nie ma aktywnej gry.
   * @throws {Error} Błąd z backendu.
   */
  async getActiveGame() {
    try {
      // Wysyłamy GET żądanie do backendu
      const response = await fetch(`${this.baseUrl}/active/`, {
        method: 'GET',
        headers: getAuthHeaders(), // Nagłówki z tokenem JWT
      });

      // Jeśli odpowiedź 404, nie ma aktywnej gry
      if (response.status === 404) {
        return null;
      }

      // Jeśli odpowiedź nie OK, obsługujemy błąd
      if (!response.ok) {
        await this._handleError(response);
      }

      // Parsujemy JSON i zwracamy grę
      const game = await response.json();
      return game;
    } catch (error) {
      // Logujemy błąd w konsoli
      console.error('Error getting active game:', error);
      // Rzucamy błąd dalej
      throw error;
    }
  }

  /**
   * Pobiera szczegóły konkretnej gry po ID.
   * 
   * @param {string} gameId - UUID gry.
   * @returns {Promise<object>} Obiekt gry.
   * @throws {Error} Błąd z backendu.
   */
  async getGame(gameId) {
    try {
      // Wysyłamy GET żądanie
      const response = await fetch(`${this.baseUrl}/${gameId}/`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      // Obsługujemy błąd
      if (!response.ok) {
        await this._handleError(response);
      }

      // Zwracamy grę
      const game = await response.json();
      return game;
    } catch (error) {
      console.error('Error getting game:', error);
      throw error;
    }
  }

  /**
   * Umieszcza statki na planszy gracza.
   * 
   * @param {string} gameId - UUID gry.
   * @param {Array<object>} ships - Tablica z danymi o statkach (wszystkie statki naraz).
   * 
   * Format ships (frontend):
   * [
   *   { size: 4, cells: [[0,0], [0,1], [0,2], [0,3]] },
   *   { size: 3, cells: [[2,2], [2,3], [2,4]] },
   *   ...
   * ]
   * 
   * Backend oczekuje pojedynczego obiektu:
   * {
   *   ship_type: "fleet",
   *   positions: [{x: 0, y: 0}, {x: 1, y: 0}, ...]
   * }
   * 
   * @returns {Promise<object>} Odpowiedź z backendu.
   * @throws {Error} Błąd z backendu.
   */
  async placeShips(gameId, ships) {
    try {
      // Spłaszczamy wszystkie komórki statków do jednej listy pozycji.
      const positions = ships.flatMap((ship) =>
        ship.cells.map(([row, col]) => ({ x: col, y: row }))
      );

      // Przygotowujemy payload zgodny z backendem.
      const payload = {
        ship_type: 'fleet',
        positions,
      };

      // Wysyłamy POST żądanie
      const response = await fetch(`${this.baseUrl}/${gameId}/ships/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      // Obsługujemy błąd
      if (!response.ok) {
        await this._handleError(response);
      }

      // Zwracamy odpowiedź
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error placing ships:', error);
      throw error;
    }
  }

  /**
   * Sprawdza czy gracze rozstawili statki.
   * 
   * @param {string} gameId - UUID gry.
   * @returns {Promise<object>} Obiekt: { player_1_ready: bool, player_2_ready: bool, can_start: bool }
   * @throws {Error} Błąd z backendu.
   */
  async checkShipsStatus(gameId) {
    try {
      // Wysyłamy GET żądanie
      const response = await fetch(`${this.baseUrl}/${gameId}/ships/status/`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      // Obsługujemy błąd
      if (!response.ok) {
        await this._handleError(response);
      }

      // Zwracamy status
      const status = await response.json();
      return status;
    } catch (error) {
      console.error('Error checking ships status:', error);
      throw error;
    }
  }

  /**
   * Akceptuje zaproszenie do gry (dla player_2).
   * 
   * @param {string} gameId - UUID gry.
   * @returns {Promise<object>} Zaktualizowany obiekt gry.
   * @throws {Error} Błąd z backendu.
   */
  async acceptGame(gameId) {
    try {
      // Wysyłamy POST żądanie
      const response = await fetch(`${this.baseUrl}/${gameId}/accept/`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      // Obsługujemy błąd
      if (!response.ok) {
        await this._handleError(response);
      }

      // Zwracamy zaktualizowaną grę
      const game = await response.json();
      return game;
    } catch (error) {
      console.error('Error accepting game:', error);
      throw error;
    }
  }

  /**
   * Odrzuca zaproszenie do gry (dla player_2).
   * 
   * @param {string} gameId - UUID gry.
   * @returns {Promise<void>} Brak zawartości (204 No Content).
   * @throws {Error} Błąd z backendu.
   */
  async declineGame(gameId) {
    try {
      // Wysyłamy POST żądanie
      const response = await fetch(`${this.baseUrl}/${gameId}/decline/`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      // Obsługujemy błąd
      if (!response.ok) {
        await this._handleError(response);
      }

      // Zwracamy (204 No Content - bez zawartości)
      return;
    } catch (error) {
      console.error('Error declining game:', error);
      throw error;
    }
  }

  /**
   * Poddaje się (forfeit) - konczy grę i daje przeciwnikowi zwycięstwo.
   * 
   * @param {string} gameId - UUID gry.
   * @returns {Promise<object>} Zaktualizowany obiekt gry.
   * @throws {Error} Błąd z backendu.
   */
  async forfeitGame(gameId) {
    try {
      // Wysyłamy POST żądanie
      const response = await fetch(`${this.baseUrl}/${gameId}/forfeit/`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      // Obsługujemy błąd
      if (!response.ok) {
        await this._handleError(response);
      }

      // Zwracamy zaktualizowaną grę
      const game = await response.json();
      return game;
    } catch (error) {
      console.error('Error forfeiting game:', error);
      throw error;
    }
  }

  /**
   * Kończy grę i zapisuje wynik (gdy wszystkie statki topione).
   * 
   * @param {string} gameId - UUID gry.
   * @param {object} endData - Dane końcowe gry.
   * @param {string} endData.winnerId - UUID zwycięzcy.
   * @param {number} endData.player1Shots - Liczba strzałów gracza 1.
   * @param {number} endData.player1Hits - Liczba trafień gracza 1.
   * @param {number} endData.player2Shots - Liczba strzałów gracza 2.
   * @param {number} endData.player2Hits - Liczba trafień gracza 2.
   * @param {string} [endData.reason='all_ships_sunk'] - Powód zakończenia.
   * @returns {Promise<object>} Zaktualizowany obiekt gry.
   * @throws {Error} Błąd z backendu.
   */
  async endGame(gameId, endData) {
    try {
      // Przygotowujemy payload
      const payload = {
        winner_id: endData.winnerId,
        player_1_shots: endData.player1Shots ?? 0,
        player_1_hits: endData.player1Hits ?? 0,
        player_2_shots: endData.player2Shots ?? 0,
        player_2_hits: endData.player2Hits ?? 0,
        reason: endData.reason ?? 'all_ships_sunk',
      };

      // Wysyłamy POST żądanie
      const response = await fetch(`${this.baseUrl}/${gameId}/end-game/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      // Obsługujemy błąd
      if (!response.ok) {
        await this._handleError(response);
      }

      // Zwracamy zaktualizowaną grę
      const game = await response.json();
      return game;
    } catch (error) {
      console.error('Error ending game:', error);
      throw error;
    }
  }

  /**
   * Pobiera listę gier użytkownika (historia).
   * 
   * @returns {Promise<Array>} Tablica gier.
   * @throws {Error} Błąd z backendu.
   */
  async listGames() {
    try {
      // Wysyłamy GET żądanie
      const response = await fetch(this.baseUrl, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      // Obsługujemy błąd
      if (!response.ok) {
        await this._handleError(response);
      }

      // Zwracamy listę gier
      const games = await response.json();
      return games;
    } catch (error) {
      console.error('Error listing games:', error);
      throw error;
    }
  }

  /**
   * Pobiera global leaderboard (top graczy).
   * 
   * @param {number} limit - Ilość graczy do pobrania (default: 100).
   * @returns {Promise<Array>} Tablica z danymi leaderboarda.
   * @throws {Error} Błąd z backendu.
   */
  async getLeaderboard(limit = 100) {
    try {
      // Wysyłamy GET żądanie
      const response = await fetch(`${this.baseUrl}/leaderboard/?limit=${limit}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      // Obsługujemy błąd
      if (!response.ok) {
        await this._handleError(response);
      }

      // Zwracamy leaderboard
      const leaderboard = await response.json();
      return leaderboard;
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  /**
   * Pobiera statystyki gracza.
   * 
   * @returns {Promise<object>} Obiekt ze statystykami gracza.
   * @throws {Error} Błąd z backendu.
   */
  async getPlayerStats() {
    try {
      // Wysyłamy GET żądanie
      const response = await fetch(`${API_BASE_URL}/games/stats/me/`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      // Obsługujemy błąd
      if (!response.ok) {
        await this._handleError(response);
      }

      // Zwracamy statystyki
      const stats = await response.json();
      return stats;
    } catch (error) {
      console.error('Error getting player stats:', error);
      throw error;
    }
  }

  /**
   * Łączy się z WebSocket dla gry.
   * 
   * @param {string} gameId - UUID gry do której chcemy się dołączyć.
   * @returns {Promise<void>} Promise rozwiązywany gdy WebSocket jest gotowy.
   * @throws {Error} Błąd połączenia WebSocket.
   * 
   * @example
   * await gameApi.connectWebSocket('game-uuid');
   * // Teraz możesz subscribe na wiadomości:
   * gameApi.on('game_move_result', (data) => { ... });
   */
  connectWebSocket(gameId) {
    return new Promise((resolve, reject) => {
      try {
        // Budujemy URL WebSocket (dostosuj do Twojej konfiguracji)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        this.wsUrl = `${protocol}//${host}/ws/games/`;

        // Tworzymy WebSocket
        this.ws = new WebSocket(this.wsUrl);

        // Ustawiamy handler dla połączenia
        this.ws.onopen = () => {
          console.log('WebSocket connected:', this.wsUrl);
          this.reconnectAttempts = 0; // Reset licznika reconnect'ów

          // Wysyłamy join message z tokenem JWT
          const token = getAuthToken();
          this.send({
            type: 'join',
            game_id: gameId,
            token: token, // Token JWT do uwierzytelniania
          });

          // Resolve promise'a - WebSocket jest gotowy
          resolve();
        };

        // Handler dla odebranych wiadomości
        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('WebSocket message received:', data);

            // Jeśli to wiadomość 'connected', oznacza to że backend potwierdził join
            if (data.type === 'connected') {
              console.log('Authenticated to game:', data);
              return;
            }

            // Uruchamiamy wszystkie handlery zarejestrowane na ten typ wiadomości
            if (this.messageHandlers[data.type]) {
              this.messageHandlers[data.type].forEach((callback) => {
                try {
                  callback(data);
                } catch (e) {
                  console.error(`Error in handler for ${data.type}:`, e);
                }
              });
            }
          } catch (e) {
            console.error('Error parsing WebSocket message:', e);
          }
        };

        // Handler dla błędów
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(new Error('WebSocket connection failed'));
        };

        // Handler dla rozłączenia
        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this._handleDisconnect();
        };
      } catch (error) {
        console.error('Error connecting WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Wysyła wiadomość przez WebSocket.
   * 
   * @param {object} message - Obiekt wiadomości do wysłania.
   * @throws {Error} Jeśli WebSocket nie jest połączony.
   * 
   * @example
   * gameApi.send({
   *   type: 'game_move',
   *   move_type: 'shoot',
   *   data: { row: 3, col: 5 }
   * });
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    try {
      this.ws.send(JSON.stringify(message));
      console.log('WebSocket message sent:', message);
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      throw error;
    }
  }

  /**
   * Rejestruje handler na typ wiadomości WebSocket.
   * 
   * @param {string} type - Typ wiadomości (np. 'game_move_result', 'turn_changed').
   * @param {function} callback - Funkcja wywoływana gdy przyjdzie wiadomość tego typu.
   * 
   * @example
   * gameApi.on('game_move_result', (data) => {
   *   console.log('Shot result:', data.hit);
   * });
   * 
   * // Można zarejestrować wiele handlerów na ten sam typ:
   * gameApi.on('turn_changed', () => { console.log('Twoja tura'); });
   * gameApi.on('turn_changed', () => { updateUI(); });
   */
  on(type, callback) {
    if (!this.messageHandlers[type]) {
      this.messageHandlers[type] = [];
    }
    this.messageHandlers[type].push(callback);

    // Zwracamy funkcję do unsubscribe'owania
    return () => {
      this.messageHandlers[type] = this.messageHandlers[type].filter(
        (cb) => cb !== callback
      );
    };
  }

  /**
   * Rozłącza się z WebSocket.
   * 
   * @example
   * gameApi.disconnectWebSocket();
   */
  disconnectWebSocket() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.messageHandlers = {};
      this.reconnectAttempts = 0;
      console.log('WebSocket disconnected intentionally');
    }
  }

  /**
   * Sprawdza czy WebSocket jest połączony.
   * 
   * @returns {boolean} True jeśli WebSocket jest OPEN.
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Wewnętrzny handler dla rozłączenia - obsługuje auto-reconnect.
   * @private
   */
  _handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delayMs = this.reconnectDelay * this.reconnectAttempts;
      console.log(
        `WebSocket disconnected. Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delayMs}ms`
      );

      setTimeout(() => {
        // Tutaj możemy spróbować reconnect'a jeśli będzie to potrzebne
        // Na razie tylko logujemy
      }, delayMs);
    }
  }

  /**
   * Wysyła strzał w grze (game move).
   * 
   * @param {number} row - Rząd (0-9)
   * @param {number} col - Kolumna (0-9)
   * @throws {Error} Jeśli WebSocket nie jest połączony
   * 
   * @example
   * await gameApi.shootAt(3, 5);
   */
  shootAt(row, col) {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected. Cannot send shot.');
    }

    // Walidacja współrzędnych
    if (typeof row !== 'number' || typeof col !== 'number' || 
        row < 0 || row > 9 || col < 0 || col > 9) {
      throw new Error('Invalid coordinates. Row and col must be between 0 and 9.');
    }

    // Wysyłamy strzał
    this.send({
      type: 'game_move',
      move_type: 'shoot',
      data: {
        row,
        col,
      },
    });

    console.log(`Shot sent to: row=${row}, col=${col}`);
  }

  /**
   * Wysyła poddanie się w grze.
   * 
   * @throws {Error} Jeśli WebSocket nie jest połączony
   */
  forfeit() {
    if (!this.isConnected()) {
      throw new Error('WebSocket not connected. Cannot forfeit game.');
    }

    this.send({
      type: 'game_forfeit',
    });

    console.log('Forfeit sent');
  }
}

// Tworzymy singleton instancji serwisu
const gameApi = new GameApiService();

// Eksportujemy serwis
export default gameApi;
