/**
 * WebSocket client module for real-time collaboration
 */

/**
 * Create and manage WebSocket connection
 * @param {string} roomId - Room ID to join
 * @param {object} handlers - Event handlers
 * @param {Function} handlers.onOpen - Called when connection opens
 * @param {Function} handlers.onMessage - Called when message received
 * @param {Function} handlers.onClose - Called when connection closes
 * @param {Function} handlers.onError - Called when error occurs
 * @returns {WebSocket} - WebSocket instance
 */
export function createWebSocketConnection(roomId, handlers) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    // eslint-disable-next-line no-console
    console.log('WebSocket connection established.');
    ws.send(JSON.stringify({ type: 'join', roomId }));
    if (handlers.onOpen) {
      handlers.onOpen();
    }
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (handlers.onMessage) {
      handlers.onMessage(data);
    }
  };

  ws.onclose = () => {
    // eslint-disable-next-line no-console
    console.log('WebSocket connection closed.');
    if (handlers.onClose) {
      handlers.onClose();
    }
  };

  ws.onerror = (error) => {
    // eslint-disable-next-line no-console
    console.error('WebSocket error:', error);
    if (handlers.onError) {
      handlers.onError(error);
    }
  };

  return ws;
}

/**
 * Send a message through WebSocket
 * @param {WebSocket} ws - WebSocket instance
 * @param {object} message - Message to send
 * @returns {void}
 */
export function sendMessage(ws, message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Close WebSocket connection
 * @param {WebSocket} ws - WebSocket instance
 * @returns {void}
 */
export function closeConnection(ws) {
  if (ws) {
    ws.close();
  }
}
