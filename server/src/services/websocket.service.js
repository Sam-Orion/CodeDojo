const WebSocket = require('ws');
const logger = require('../utils/logger');
const { wsConnectionsActive, wsMessagesTotal, otOperationTotal } = require('../utils/metrics');
const config = require('../config/env');
const roomManagerService = require('./room-manager.service');
const otService = require('./ot.service');
const persistenceService = require('./persistence.service');
const { MessageValidator, MessageTypes } = require('./message-validator.service');
const terminalOrchestratorService = require('./terminal-orchestrator.service');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.heartbeatInterval = null;
    this.messageValidator = new MessageValidator();
    this.roomManager = roomManagerService;
    this.otService = otService;
    this.persistenceService = persistenceService;
  }

  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      maxPayload: config.WS_MAX_PAYLOAD,
    });

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.startHeartbeat();
    this.roomManager.initializeCleanup(60000); // Cleanup every 60 seconds

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

      // Validate message
      const validation = this.messageValidator.validate(data);
      if (!validation.valid) {
        this.sendMessage(
          ws,
          this.messageValidator.buildErrorMessage(
            new Error(validation.error),
            data.roomId,
            data.clientId
          )
        );
        return;
      }

      wsMessagesTotal.inc({ type: 'received', event: data.type });

      logger.debug(`WebSocket message received`, {
        clientId: ws.id,
        type: data.type,
        roomId: data.roomId,
      });

      switch (data.type) {
        case MessageTypes.JOIN_ROOM:
          this.handleJoinRoom(ws, data);
          break;
        case MessageTypes.LEAVE_ROOM:
          this.handleLeaveRoom(ws, data);
          break;
        case MessageTypes.OT_OP:
          this.handleOTOperation(ws, data);
          break;
        case MessageTypes.CURSOR_UPDATE:
          this.handleCursorUpdate(ws, data);
          break;
        case MessageTypes.SYNC_STATE:
          this.handleSyncState(ws, data);
          break;
        case MessageTypes.ACK:
          this.handleAck(ws, data);
          break;
        case MessageTypes.TERMINAL_CREATE:
          this.handleTerminalCreate(ws, data);
          break;
        case MessageTypes.TERMINAL_INPUT:
          this.handleTerminalInput(ws, data);
          break;
        case MessageTypes.TERMINAL_RESIZE:
          this.handleTerminalResize(ws, data);
          break;
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
          this.handleTerminalInputLegacy(ws, data);
          break;
        case 'terminal:resize':
          this.handleTerminalResizeLegacy(ws, data);
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

  // OT-specific handlers

  handleJoinRoom(ws, data) {
    const { roomId, userId, clientId, userInfo } = data;

    try {
      // Check rate limit
      const room = this.roomManager.getRoom(roomId);
      if (!room) {
        this.roomManager.joinRoom(roomId, clientId, ws, userId);
      } else {
        const joinResult = this.roomManager.joinRoom(roomId, clientId, ws, userId);
        if (!joinResult.success) {
          this.sendMessage(
            ws,
            this.messageValidator.buildErrorMessage(
              new Error(joinResult.reason || 'Failed to join room'),
              roomId,
              clientId
            )
          );
          return;
        }
      }

      const room2 = this.roomManager.getRoom(roomId);
      const snapshot = this.otService.getSnapshot(roomId);

      // Track client in room
      if (!ws.rooms) {
        ws.rooms = new Set();
      }
      ws.rooms.add(roomId);

      logger.info('Client joined room', {
        roomId,
        clientId,
        userId,
        participantCount: room2.connections.size,
      });

      // Send join confirmation with snapshot
      this.sendMessage(ws, {
        type: 'JOIN_ROOM_ACK',
        roomId,
        clientId,
        version: snapshot.version,
        content: snapshot.content,
        participants: room2.getParticipants(),
      });

      // Broadcast participant joined to others
      this.broadcastToRoom(roomId, clientId, {
        type: 'PARTICIPANT_JOINED',
        roomId,
        clientId,
        userId,
        participants: room2.getParticipants(),
        userInfo,
      });

      wsMessagesTotal.inc({ type: 'sent', event: 'JOIN_ROOM_ACK' });
    } catch (error) {
      logger.error('Error handling join room', { roomId, clientId, error });
      this.sendMessage(ws, this.messageValidator.buildErrorMessage(error, roomId, clientId));
    }
  }

  handleLeaveRoom(ws, data) {
    const { roomId, clientId } = data;

    try {
      const result = this.roomManager.leaveRoom(roomId, clientId);

      if (result.success) {
        ws.rooms?.delete(roomId);

        logger.info('Client left room', { roomId, clientId });

        // Broadcast participant left to others
        this.broadcastToRoom(roomId, null, {
          type: 'PARTICIPANT_LEFT',
          roomId,
          clientId,
        });

        // Send leave confirmation
        this.sendMessage(ws, {
          type: 'LEAVE_ROOM_ACK',
          roomId,
          clientId,
        });
      }
    } catch (error) {
      logger.error('Error handling leave room', { roomId, clientId, error });
      this.sendMessage(ws, this.messageValidator.buildErrorMessage(error, roomId, clientId));
    }
  }

  handleOTOperation(ws, data) {
    const { roomId, clientId, operation, userId } = data;

    try {
      const room = this.roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      // Check rate limit
      const rateLimitResult = room.applyRateLimit(clientId);
      if (!rateLimitResult.allowed) {
        this.sendMessage(
          ws,
          this.messageValidator.buildErrorMessage(
            new Error(rateLimitResult.reason),
            roomId,
            clientId
          )
        );

        if (rateLimitResult.backpressured) {
          // Send backpressure signal
          this.sendMessage(ws, {
            type: 'BACKPRESSURE',
            roomId,
            clientId,
            message: 'Server is backpressured, please slow down',
          });
        }
        return;
      }

      // Update activity
      room.updateActivity(clientId);

      // Create operation object with metadata
      const op = {
        id: operation.id,
        clientId,
        version: operation.version,
        type: operation.type,
        position: operation.position,
        content: operation.content,
        userId,
        timestamp: Date.now(),
      };

      // Apply OT transformation
      const result = this.otService.applyOperation(roomId, op);

      if (!result.success) {
        throw new Error('Failed to apply operation');
      }

      // Persist operation asynchronously
      this.persistenceService.saveOperation(roomId, op).catch((err) => {
        logger.error('Failed to persist operation', { roomId, operationId: op.id, err });
      });

      // Send ack to sender
      this.sendMessage(
        ws,
        this.messageValidator.buildAckMessage(roomId, clientId, operation.id, result.version)
      );

      // Broadcast operation to other clients
      this.broadcastToRoom(roomId, clientId, {
        type: 'OT_OP_BROADCAST',
        roomId,
        operation: result.operation,
        version: result.version,
        senderClientId: clientId,
      });

      wsMessagesTotal.inc({ type: 'sent', event: 'ACK' });
      otOperationTotal.inc({ type: operation.type, status: 'broadcast' });
    } catch (error) {
      logger.error('Error handling OT operation', { roomId, clientId, error });
      this.sendMessage(ws, this.messageValidator.buildErrorMessage(error, roomId, clientId));
      otOperationTotal.inc({ type: data.operation?.type || 'unknown', status: 'error' });
    }
  }

  handleCursorUpdate(ws, data) {
    const { roomId, clientId, cursor, userId } = data;

    try {
      const room = this.roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      // Update cursor in room
      room.updateCursor(clientId, cursor);
      room.updateActivity(clientId);

      // Save cursor state to MongoDB
      if (userId) {
        this.persistenceService.saveCursorState(roomId, userId, clientId, cursor).catch((err) => {
          logger.debug('Failed to persist cursor state', {
            roomId,
            userId,
            err,
          });
        });
      }

      // Broadcast cursor update to other clients
      this.broadcastToRoom(roomId, clientId, {
        type: 'CURSOR_UPDATE_BROADCAST',
        roomId,
        clientId,
        userId,
        cursor,
      });

      wsMessagesTotal.inc({ type: 'sent', event: 'CURSOR_UPDATE_BROADCAST' });
    } catch (error) {
      logger.error('Error handling cursor update', { roomId, clientId, error });
      this.sendMessage(ws, this.messageValidator.buildErrorMessage(error, roomId, clientId));
    }
  }

  handleSyncState(ws, data) {
    const { roomId, clientId, fromVersion } = data;

    try {
      const room = this.roomManager.getRoom(roomId);
      if (!room) {
        throw new Error('Room not found');
      }

      const snapshot = this.otService.getSnapshot(roomId);
      let operations = [];

      // Get operations since the specified version
      if (fromVersion !== undefined && fromVersion < snapshot.version) {
        operations = this.otService.getOperationsSince(roomId, clientId, fromVersion);
      }

      // Get cursor states
      this.persistenceService.getCursorStates(roomId).then((cursorStates) => {
        this.sendMessage(ws, {
          type: 'SYNC_STATE_RESPONSE',
          roomId,
          clientId,
          snapshot: {
            version: snapshot.version,
            content: snapshot.content,
          },
          operations,
          cursorStates: cursorStates.map((cs) => ({
            userId: cs.userId,
            clientId: cs.clientId,
            cursor: cs.cursor,
          })),
          participants: room.getParticipants(),
        });

        wsMessagesTotal.inc({ type: 'sent', event: 'SYNC_STATE_RESPONSE' });
      });

      room.updateActivity(clientId);
    } catch (error) {
      logger.error('Error handling sync state', { roomId, clientId, error });
      this.sendMessage(ws, this.messageValidator.buildErrorMessage(error, roomId, clientId));
    }
  }

  handleAck(ws, data) {
    const { roomId, clientId, operationId } = data;

    try {
      this.otService.acknowledgeOperation(roomId, clientId, operationId);
      logger.debug('Operation acknowledged', { roomId, clientId, operationId });
    } catch (error) {
      logger.error('Error handling ack', { roomId, clientId, error });
    }
  }

  broadcastToRoom(roomId, excludeClientId, message) {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    const connections = room.broadcast(message, excludeClientId);
    for (const { ws } of connections) {
      this.sendMessage(ws, message);
    }
  }

  // Legacy collaboration handlers (keeping for backward compatibility)
  handleCollaborationJoin(ws, data) {
    const { roomId } = data;

    if (!roomId) {
      this.sendMessage(ws, {
        type: 'error',
        message: 'Room ID is required',
      });
      return;
    }

    try {
      // Use new room manager
      const userId = `user_${ws.id}`;
      const result = this.roomManager.joinRoom(roomId, ws.id, ws, userId);

      if (!result.success) {
        this.sendMessage(ws, {
          type: 'error',
          message: result.reason || 'Failed to join room',
        });
        return;
      }

      const snapshot = this.otService.getSnapshot(roomId);

      if (!ws.rooms) {
        ws.rooms = new Set();
      }
      ws.rooms.add(roomId);

      logger.info(`Client ${ws.id} joined collaboration room: ${roomId}`);

      this.sendMessage(ws, {
        type: 'collaboration:joined',
        roomId,
        content: snapshot.content,
        participants: result.participantCount,
      });

      this.broadcastToRoom(roomId, ws.id, {
        type: 'collaboration:participant-joined',
        roomId,
        clientId: ws.id,
        participants: result.participantCount,
      });
    } catch (error) {
      logger.error('Error in collaboration join', { roomId, error });
      this.sendMessage(ws, {
        type: 'error',
        message: 'Failed to join room',
      });
    }
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

    try {
      const currentRoom = this.roomManager.getRoom(roomId);
      if (!currentRoom) {
        this.sendMessage(ws, {
          type: 'error',
          message: 'Room not found',
        });
        return;
      }

      // Create and apply operation
      const op = {
        id: `op_${Date.now()}_${Math.random()}`,
        clientId: ws.id,
        version: this.otService.getSnapshot(roomId).version,
        type: 'insert',
        position: 0,
        content,
        userId: currentRoom.clientIdToUserId.get(ws.id),
        timestamp: Date.now(),
      };

      const result = this.otService.applyOperation(roomId, op);

      this.broadcastToRoom(roomId, ws.id, {
        type: 'collaboration:update',
        roomId,
        content: result.content,
        clientId: ws.id,
        version: result.version,
      });
    } catch (error) {
      logger.error('Error in collaboration update', { roomId, error });
      this.sendMessage(ws, {
        type: 'error',
        message: 'Failed to update collaboration',
      });
    }
  }

  handleCollaborationLeave(ws, data) {
    const { roomId } = data;
    try {
      this.roomManager.leaveRoom(roomId, ws.id);
      ws.rooms?.delete(roomId);
      this.broadcastToRoom(roomId, null, {
        type: 'collaboration:participant-left',
        roomId,
        clientId: ws.id,
      });
    } catch (error) {
      logger.error('Error in collaboration leave', { roomId, error });
    }
  }

  async handleTerminalCreate(ws, data) {
    try {
      const result = await terminalOrchestratorService.createTerminalSession({
        userId: data.userId || ws.id,
        roomId: data.roomId,
        language: data.language,
        file: data.file,
        workspaceDir: data.workspaceDir,
        isRepl: data.isRepl || false,
        mode: data.mode || 'auto',
        useContainer: data.useContainer !== false,
        env: data.env || {},
        metadata: data.metadata || {},
      });

      const session = terminalOrchestratorService.getSession(result.sessionId);
      const executor = session.executor;

      if (executor) {
        if (executor.type === 'pty' && executor.ptyProcess) {
          executor.ptyProcess.onData((data) => {
            this.sendMessage(ws, {
              type: MessageTypes.TERMINAL_OUTPUT,
              sessionId: result.sessionId,
              data,
            });
          });

          executor.ptyProcess.onExit(({ exitCode, signal }) => {
            this.sendMessage(ws, {
              type: MessageTypes.TERMINAL_EXIT,
              sessionId: result.sessionId,
              exitCode,
              signal,
            });
          });
        } else if (executor.type === 'container' && executor.stream) {
          executor.stream.on('data', (chunk) => {
            this.sendMessage(ws, {
              type: MessageTypes.TERMINAL_OUTPUT,
              sessionId: result.sessionId,
              data: chunk.toString('utf8'),
            });
          });

          executor.stream.on('end', () => {
            this.sendMessage(ws, {
              type: MessageTypes.TERMINAL_EXIT,
              sessionId: result.sessionId,
              exitCode: 0,
            });
          });
        }
      }

      this.sendMessage(ws, {
        type: MessageTypes.TERMINAL_CREATE,
        sessionId: result.sessionId,
        mode: result.mode,
        status: 'running',
        language: result.language,
      });

      logger.info(`Terminal session created for client ${ws.id}`, {
        sessionId: result.sessionId,
      });
    } catch (error) {
      logger.error('Error creating terminal session:', error);
      this.sendMessage(ws, {
        type: MessageTypes.TERMINAL_ERROR,
        error: error.message,
        code: 'TERMINAL_CREATE_ERROR',
      });
    }
  }

  async handleTerminalInput(ws, data) {
    try {
      await terminalOrchestratorService.sendInput(data.sessionId, data.data);
    } catch (error) {
      logger.error('Error sending terminal input:', error);
      this.sendMessage(ws, {
        type: MessageTypes.TERMINAL_ERROR,
        sessionId: data.sessionId,
        error: error.message,
        code: 'TERMINAL_INPUT_ERROR',
      });
    }
  }

  async handleTerminalResize(ws, data) {
    try {
      await terminalOrchestratorService.resizeTerminal(data.sessionId, data.cols, data.rows);
    } catch (error) {
      logger.error('Error resizing terminal:', error);
      this.sendMessage(ws, {
        type: MessageTypes.TERMINAL_ERROR,
        sessionId: data.sessionId,
        error: error.message,
        code: 'TERMINAL_RESIZE_ERROR',
      });
    }
  }

  handleTerminalInputLegacy(ws, data) {
    logger.debug('Terminal input received (legacy placeholder)', {
      clientId: ws.id,
      data,
    });
    this.sendMessage(ws, {
      type: 'terminal:output',
      message: 'Terminal functionality not yet implemented. Use TERMINAL_CREATE message type.',
    });
  }

  handleTerminalResizeLegacy(ws, data) {
    logger.debug('Terminal resize received (legacy placeholder)', {
      clientId: ws.id,
      data,
    });
  }

  handleDisconnection(ws) {
    logger.info(`WebSocket client disconnected: ${ws.id}`);

    // Cleanup terminal sessions for this user
    const userSessions = terminalOrchestratorService.getUserSessions(ws.id);
    userSessions.forEach(async (session) => {
      try {
        await terminalOrchestratorService.terminateSession(session.id);
      } catch (error) {
        logger.error('Error terminating terminal session on disconnect', {
          sessionId: session.id,
          error,
        });
      }
    });

    // Leave all rooms
    if (ws.rooms) {
      ws.rooms.forEach((roomId) => {
        try {
          this.roomManager.leaveRoom(roomId, ws.id);
          this.broadcastToRoom(roomId, null, {
            type: 'collaboration:participant-left',
            roomId,
            clientId: ws.id,
          });
        } catch (error) {
          logger.error('Error leaving room on disconnect', { roomId, error });
        }
      });
    }

    this.clients.delete(ws.id);
    wsConnectionsActive.dec();
  }

  removeClientFromRoom(ws, roomId) {
    try {
      const result = this.roomManager.leaveRoom(roomId, ws.id);
      if (result.success) {
        ws.rooms?.delete(roomId);

        this.broadcastToRoom(roomId, null, {
          type: 'collaboration:participant-left',
          roomId,
          clientId: ws.id,
          participants: result.participantCount,
        });

        if (result.isEmpty) {
          logger.info(`Room ${roomId} is empty, removed`);
        }
      }
    } catch (error) {
      logger.error('Error removing client from room', { roomId, error });
    }
  }

  broadcast(roomId, sender, message) {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    const connections = room.broadcast(message, sender?.id);
    for (const { ws } of connections) {
      this.sendMessage(ws, message);
    }
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

    if (this.roomManager) {
      this.roomManager.shutdown();
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
