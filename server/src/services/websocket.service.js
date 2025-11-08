const WebSocket = require('ws');
const logger = require('../utils/logger');
const { wsConnectionsActive, wsMessagesTotal } = require('../utils/metrics');
const config = require('../config/env');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.rooms = new Map();
    this.clients = new Map();
    this.heartbeatInterval = null;
  }

  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      maxPayload: config.WS_MAX_PAYLOAD,
    });

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.startHeartbeat();

    logger.info('WebSocket server initialized');
  }

  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    ws.id = clientId;
    ws.isAlive = true;
    ws.rooms = new Set();

    this.clients.set(clientId, ws);
    wsConnectionsActive.inc();

    logger.info(`WebSocket client connected: ${clientId}`, {
      ip: req.socket.remoteAddress,
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      this.handleMessage(ws, message);
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });

    ws.on('error', (error) => {
      logger.error(`WebSocket error for client ${clientId}:`, error);
    });

    this.sendMessage(ws, {
      type: 'connection',
      clientId,
      message: 'Connected to CodeDojo server',
    });
  }

  handleMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      wsMessagesTotal.inc({ type: 'received', event: data.type || 'unknown' });

      logger.debug(`WebSocket message received`, {
        clientId: ws.id,
        type: data.type,
      });

      switch (data.type) {
        case 'collaboration:join':
          this.handleCollaborationJoin(ws, data);
          break;
        case 'collaboration:update':
          this.handleCollaborationUpdate(ws, data);
          break;
        case 'collaboration:leave':
          this.handleCollaborationLeave(ws, data);
          break;
        case 'terminal:input':
          this.handleTerminalInput(ws, data);
          break;
        case 'terminal:resize':
          this.handleTerminalResize(ws, data);
          break;
        case 'ping':
          this.sendMessage(ws, { type: 'pong' });
          break;
        default:
          logger.warn(`Unknown WebSocket message type: ${data.type}`);
      }
    } catch (error) {
      logger.error('Error handling WebSocket message:', error);
      this.sendMessage(ws, {
        type: 'error',
        message: 'Invalid message format',
      });
    }
  }

  handleCollaborationJoin(ws, data) {
    const { roomId } = data;

    if (!roomId) {
      this.sendMessage(ws, {
        type: 'error',
        message: 'Room ID is required',
      });
      return;
    }

    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        clients: new Set(),
        content: '',
      });
    }

    const room = this.rooms.get(roomId);
    room.clients.add(ws);
    ws.rooms.add(roomId);

    logger.info(`Client ${ws.id} joined collaboration room: ${roomId}`);

    this.sendMessage(ws, {
      type: 'collaboration:joined',
      roomId,
      content: room.content,
      participants: room.clients.size,
    });

    this.broadcast(roomId, ws, {
      type: 'collaboration:participant-joined',
      roomId,
      clientId: ws.id,
      participants: room.clients.size,
    });
  }

  handleCollaborationUpdate(ws, data) {
    const { roomId, content } = data;

    if (!roomId || content === undefined) {
      this.sendMessage(ws, {
        type: 'error',
        message: 'Room ID and content are required',
      });
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      this.sendMessage(ws, {
        type: 'error',
        message: 'Room not found',
      });
      return;
    }

    room.content = content;

    this.broadcast(roomId, ws, {
      type: 'collaboration:update',
      roomId,
      content,
      clientId: ws.id,
    });
  }

  handleCollaborationLeave(ws, data) {
    const { roomId } = data;
    this.removeClientFromRoom(ws, roomId);
  }

  handleTerminalInput(ws, data) {
    logger.debug('Terminal input received (placeholder)', {
      clientId: ws.id,
      data,
    });
    this.sendMessage(ws, {
      type: 'terminal:output',
      message: 'Terminal functionality not yet implemented',
    });
  }

  handleTerminalResize(ws, data) {
    logger.debug('Terminal resize received (placeholder)', {
      clientId: ws.id,
      data,
    });
  }

  handleDisconnection(ws) {
    logger.info(`WebSocket client disconnected: ${ws.id}`);

    ws.rooms.forEach((roomId) => {
      this.removeClientFromRoom(ws, roomId);
    });

    this.clients.delete(ws.id);
    wsConnectionsActive.dec();
  }

  removeClientFromRoom(ws, roomId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.clients.delete(ws);
      ws.rooms.delete(roomId);

      this.broadcast(roomId, null, {
        type: 'collaboration:participant-left',
        roomId,
        clientId: ws.id,
        participants: room.clients.size,
      });

      if (room.clients.size === 0) {
        logger.info(`Room ${roomId} is empty, removing it`);
        this.rooms.delete(roomId);
      }
    }
  }

  broadcast(roomId, sender, message) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.clients.forEach((client) => {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        this.sendMessage(client, message);
      }
    });
  }

  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      wsMessagesTotal.inc({ type: 'sent', event: message.type || 'unknown' });
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          logger.warn(`Terminating inactive WebSocket client: ${ws.id}`);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, config.WS_HEARTBEAT_INTERVAL);
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.wss) {
      this.wss.clients.forEach((ws) => {
        ws.close(1000, 'Server shutting down');
      });
      this.wss.close(() => {
        logger.info('WebSocket server closed');
      });
    }
  }
}

module.exports = new WebSocketService();
