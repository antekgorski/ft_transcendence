/**
 * WebSocket client for real-time game communication
 */

class GameSocket {
  constructor() {
    this.socket = null;
    this.gameId = null;
    this.pendingGameId = null;
    this.messageHandlers = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.heartbeatInterval = null;
    this._gameEnded = false; // Flag to prevent reconnection after game ends
  }

  /**
   * Connect to the game WebSocket
   * @param {string} gameId - ID of the game to connect to
   * @param {function} onConnect - Callback when connected
   * @param {function} onError - Callback on error
   * @param {object} options - Connection options (e.g., { silent: true })
   */
  connect(gameId, onConnect, onError, options = {}) {
    const { silent = false } = options;

    // If game ID changed, close old socket and create new one
    if (this.gameId && this.gameId !== gameId && this.socket) {
      this.socket.close();
      this.socket = null;
    }

    // If already connected or connecting to this game, handle appropriately
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      if (this.socket.readyState === WebSocket.OPEN) {
        // Socket is open, send join immediately
        this.send({
          type: 'join',
          game_id: gameId,
        });
      } else {
        // Socket is still CONNECTING, queue the gameId to join when it opens
        this.pendingGameId = gameId;
      }
      return;
    }

    this.gameId = gameId;
    this.pendingGameId = null;
    // Use relative WebSocket URL that works through nginx proxy
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/games/`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;

        // Send join message for the requested game
        this.send({
          type: 'join',
          game_id: gameId,
        });

        // Start heartbeat
        this.startHeartbeat();

        if (onConnect) onConnect();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Route to specific handler
          if (this.messageHandlers[data.type]) {
            this.messageHandlers[data.type](data);
          }
        } catch (err) {
          // Silently handle parse errors
        }
      };

      this.socket.onerror = (error) => {
        // Silently handle connection errors to avoid console spam
        // The connection will be retried automatically
        if (onError) onError(error);
      };

      this.socket.onclose = () => {
        this.stopHeartbeat();

        // Attempt reconnect only if game is active and we haven't exceeded max attempts
        if (this.reconnectAttempts < this.maxReconnectAttempts && gameId && !this._gameEnded) {
          this.reconnectAttempts++;
          setTimeout(() => {
            this.connect(gameId, onConnect, onError, options);
          }, this.reconnectDelay);
        }
      };
    } catch (err) {
      // Silently handle connection initialization errors
      if (onError) onError(err);
    }
  }

  /**
   * Pre-connect to WebSocket (doesn't join a specific game yet)
   * Used for early connection after authentication
   */
  preConnect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/games/`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.reconnectAttempts = 0;
        this.startHeartbeat();

        // If a gameId was queued while connecting, join it now
        if (this.pendingGameId) {
          this.gameId = this.pendingGameId;
          this.pendingGameId = null;
          this.send({
            type: 'join',
            game_id: this.gameId,
          });
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const handler = this.messageHandlers[data.type];
          if (handler) {
            handler(data);
          }
        } catch (err) {
          // Silently ignore parse errors
        }
      };

      this.socket.onerror = (event) => {
        // Prevent error event from propagating
        event.preventDefault?.();
      };

      this.socket.onclose = () => {
        this.stopHeartbeat();
      };
    } catch (err) {
      // Silently handle connection initialization errors
    }
  }

  /**
   * Register a handler for a specific message type
   * @param {string} messageType - Type of message to handle
   * @param {function} handler - Function to call when message is received
   */
  on(messageType, handler) {
    this.messageHandlers[messageType] = handler;
  }

  /**
   * Remove a message handler
   * @param {string} messageType - Type of message
   */
  off(messageType) {
    delete this.messageHandlers[messageType];
  }

  /**
   * Send a message to the server
   * @param {object} data - Data to send
   */
  send(data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.socket.send(JSON.stringify(data));
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          timestamp: Date.now(),
        });
      }
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send a game move (shot)
   * @param {number} row - Row coordinate
   * @param {number} col - Column coordinate
   */
  sendShot(row, col) {
    return this.send({
      type: 'game_move',
      move_type: 'shot',
      data: {
        row,
        col,
      },
    });
  }

  /**
   * Send forfeit
   */
  sendForfeit() {
    return this.send({
      type: 'game_forfeit',
    });
  }

  /**
   * Close the connection and mark game as ended (stops reconnection)
   */
  disconnect() {
    this._gameEnded = true; // Prevent reconnection attempts
    this.stopHeartbeat();
    if (this.socket) {
      // Only close if socket is fully OPEN - closing CONNECTING sockets causes warnings
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.close();
      }
      this.socket = null;
    }
    this.gameId = null;
    this.pendingGameId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Reset socket state for a new game (clears game ended flag)
   */
  reset() {
    this._gameEnded = false;
    this.gameId = null;
    this.pendingGameId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Check if socket is connected
   */
  isConnected() {
    return this.socket && this.socket.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const gameSocket = new GameSocket();
