/**
 * WebSocket Manager
 * 
 * Klasa do zarządzania WebSocket połączeniem dla gry.
 * Obsługuje łączenie, wysyłanie wiadomości, odbieranie wiadomości i automatyczne reconnect.
 */

import { WS_BASE_URL, getAuthToken } from '../config/api';

/**
 * Klasa WebSocketManager zarządza WebSocket połączeniem.
 */
class WebSocketManager {
  /**
   * Konstruktor - inicjalizuje zmienne.
   * 
   * @param {string} gameId - UUID gry do której się łączymy.
   * @param {string} userId - UUID użytkownika.
   */
  constructor(gameId, userId) {
    // UUID gry do której się łączymy
    this.gameId = gameId;
    // UUID zalogowanego użytkownika
    this.userId = userId;
    // WebSocket instancja (null gdy nie połączony)
    this.ws = null;
    // Flaga czy jesteśmy połączeni
    this.isConnected = false;
    // Licznik prób reconnectu
    this.reconnectAttempts = 0;
    // Maksymalna liczba prób reconnectu
    this.maxReconnectAttempts = 5;
    // Delay między próbami reconnectu (w ms)
    this.reconnectDelay = 3000;
    // Callback wywoływany gdy dostaniemy wiadomość
    this.onMessageCallback = null;
    // Callback wywoływany gdy się połączymy
    this.onConnectCallback = null;
    // Callback wywoływany gdy się rozłączymy
    this.onDisconnectCallback = null;
    // Callback wywoływany na błąd
    this.onErrorCallback = null;
  }

  /**
   * Łączy się z WebSocket serwerem.
   * 
   * @returns {Promise<void>} Promise który się resolve gdy połączenie jest otwarte.
   */
  connect() {
    return new Promise((resolve, reject) => {
      try {
        // Budujemy URL do WebSocket (z tokenem w query params)
        const token = getAuthToken();
        const wsUrl = `${WS_BASE_URL}/ws/games/?token=${token || ''}`;

        // Logujemy próbę połączenia
        console.log('Connecting to WebSocket:', wsUrl);

        // Tworzymy nowe WebSocket połączenie
        this.ws = new WebSocket(wsUrl);

        // Callback na otwarcie połączenia
        this.ws.onopen = () => {
          console.log('WebSocket connected');
          // Ustawiamy flagi
          this.isConnected = true;
          this.reconnectAttempts = 0;

          // Wysyłamy wiadomość "join" do dołączenia do pokoju gry
          this.send({
            type: 'join',
            game_id: this.gameId,
          });

          // Wywoływamy callback podłączenia
          if (this.onConnectCallback) {
            this.onConnectCallback();
          }

          // Resolve promise
          resolve();
        };

        // Callback na otrzymanie wiadomości
        this.ws.onmessage = (event) => {
          try {
            // Parsujemy JSON
            const data = JSON.parse(event.data);
            // Logujemy otrzymaną wiadomość
            console.log('WebSocket message received:', data);

            // Wywoływamy callback z wiadomością
            if (this.onMessageCallback) {
              this.onMessageCallback(data);
            }
          } catch (error) {
            // Jeśli parsing się nie powiódł, logujemy błąd
            console.error('Error parsing WebSocket message:', error);
          }
        };

        // Callback na błąd
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          // Wywoływamy callback błędu
          if (this.onErrorCallback) {
            this.onErrorCallback(error);
          }
        };

        // Callback na zamknięcie połączenia
        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          // Ustawiamy flagi
          this.isConnected = false;

          // Wywoływamy callback rozłączenia
          if (this.onDisconnectCallback) {
            this.onDisconnectCallback();
          }

          // Jeśli zamknięcie było nieumyślne (kod nie 1000), próbujemy reconnect
          if (event.code !== 1000) {
            this._attemptReconnect();
          }
        };
      } catch (error) {
        // Jeśli coś się nie powiodło, rejectujemy promise
        console.error('Error creating WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Wysyła wiadomość przez WebSocket.
   * 
   * @param {object} data - Obiekt do wysłania (będzie skonwertowany na JSON).
   * @returns {boolean} True jeśli wysłano, false jeśli nie jesteśmy połączeni.
   * 
   * @example
   * ws.send({ type: 'game_move', move_type: 'shoot', data: { row: 2, col: 3 } });
   */
  send(data) {
    // Sprawdzamy czy WebSocket jest otwarty
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected. Message not sent:', data);
      return false;
    }

    try {
      // Konwertujemy obiekt na JSON
      const message = JSON.stringify(data);
      // Wysyłamy przez WebSocket
      this.ws.send(message);
      // Logujemy wysłaną wiadomość
      console.log('WebSocket message sent:', data);
      return true;
    } catch (error) {
      // Jeśli coś się nie powiodło, logujemy błąd
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }

  /**
   * Ustawia callback wywoływany gdy dostaniemy wiadomość.
   * 
   * @param {Function} callback - Funkcja która będzie wywołana z danymi wiadomości.
   * 
   * @example
   * ws.onMessage((data) => {
   *   console.log('Received:', data);
   * });
   */
  onMessage(callback) {
    this.onMessageCallback = callback;
  }

  /**
   * Ustawia callback wywoływany gdy się połączymy.
   * 
   * @param {Function} callback - Funkcja która będzie wywołana.
   */
  onConnect(callback) {
    this.onConnectCallback = callback;
  }

  /**
   * Ustawia callback wywoływany gdy się rozłączymy.
   * 
   * @param {Function} callback - Funkcja która będzie wywołana.
   */
  onDisconnect(callback) {
    this.onDisconnectCallback = callback;
  }

  /**
   * Ustawia callback wywoływany na błąd.
   * 
   * @param {Function} callback - Funkcja która będzie wywołana z błędem.
   */
  onError(callback) {
    this.onErrorCallback = callback;
  }

  /**
   * Rozłącza się z WebSocket serwerem.
   */
  disconnect() {
    // Logujemy rozłączenie
    console.log('Disconnecting from WebSocket');

    // Jeśli istnieje WebSocket, zamykamy go
    if (this.ws) {
      // Normalnie zamykamy (kod 1000)
      this.ws.close(1000, 'Client disconnect');
    }

    // Ustawiamy flagi
    this.isConnected = false;
  }

  /**
   * Próbuje reconnect do WebSocket.
   * @private
   */
  _attemptReconnect() {
    // Sprawdzamy czy nie przekroczyliśmy limitu prób
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached. Giving up.');
      return;
    }

    // Inkrementujemy licznik prób
    this.reconnectAttempts += 1;

    // Obliczamy delay z exponential backoff
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    // Logujemy próbę reconnectu
    console.log(`Attempting to reconnect (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);

    // Czekamy delay i próbujemy reconnect
    setTimeout(() => {
      // Próbujemy się reconnectować (ale nie czekamy na promise)
      this.connect().catch((error) => {
        console.error('Reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Sprawdza czy jesteśmy połączeni.
   * 
   * @returns {boolean} True jeśli połączeni, false w przeciwnym razie.
   */
  isConnectedStatus() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Pobiera stan WebSocket.
   * 
   * @returns {string} Stan: 'CONNECTING', 'OPEN', 'CLOSING', 'CLOSED' lub 'UNKNOWN'.
   */
  getStatus() {
    if (!this.ws) {
      return 'UNKNOWN';
    }

    const states = {
      0: 'CONNECTING',
      1: 'OPEN',
      2: 'CLOSING',
      3: 'CLOSED',
    };

    return states[this.ws.readyState] || 'UNKNOWN';
  }
}

// Eksportujemy klasę
export default WebSocketManager;
