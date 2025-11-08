const logger = require('../utils/logger');

class UserPresence {
  constructor(userId, clientId, cursor = { line: 0, column: 0 }) {
    this.userId = userId;
    this.clientId = clientId;
    this.cursor = cursor;
    this.joinedAt = Date.now();
    this.lastActivity = Date.now();
  }

  updateCursor(cursor) {
    this.cursor = cursor;
    this.lastActivity = Date.now();
  }

  updateActivity() {
    this.lastActivity = Date.now();
  }
}

class Room {
  constructor(roomId, maxParticipants = 50, options = {}) {
    this.roomId = roomId;
    this.maxParticipants = maxParticipants;
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
    this.presence = new Map(); // clientId -> UserPresence
    this.connections = new Map(); // clientId -> WebSocket
    this.clientIdToUserId = new Map(); // clientId -> userId
    this.version = 0;
    this.options = {
      enableCursorTracking: options.enableCursorTracking !== false,
      enableHistorySync: options.enableHistorySync !== false,
      ttlMs: options.ttlMs || 30 * 60 * 1000, // 30 minutes default
      ...options,
    };
    this.rateLimitConfig = {
      windowMs: 1000,
      maxOpsPerWindow: 50,
      backpressureThreshold: 100,
    };
    this.clientRateLimits = new Map(); // clientId -> { ops: [], backpressured: boolean }
  }

  addConnection(clientId, ws, userId) {
    if (this.connections.size >= this.maxParticipants) {
      throw new Error(`Room ${this.roomId} is at maximum capacity`);
    }

    this.connections.set(clientId, ws);
    this.clientIdToUserId.set(clientId, userId);
    this.presence.set(clientId, new UserPresence(userId, clientId));
    this.clientRateLimits.set(clientId, { ops: [], backpressured: false });
    this.lastActivityAt = Date.now();

    logger.info('Client added to room', {
      roomId: this.roomId,
      clientId,
      userId,
      size: this.connections.size,
    });

    return {
      success: true,
      participantCount: this.connections.size,
    };
  }

  removeConnection(clientId) {
    if (this.connections.has(clientId)) {
      this.connections.delete(clientId);
      this.presence.delete(clientId);
      this.clientIdToUserId.delete(clientId);
      this.clientRateLimits.delete(clientId);
      this.lastActivityAt = Date.now();

      logger.info('Client removed from room', {
        roomId: this.roomId,
        clientId,
        size: this.connections.size,
      });

      return {
        success: true,
        participantCount: this.connections.size,
        isEmpty: this.connections.size === 0,
      };
    }

    return { success: false };
  }

  getParticipants() {
    return Array.from(this.presence.values()).map((p) => ({
      userId: p.userId,
      clientId: p.clientId,
      cursor: p.cursor,
      joinedAt: p.joinedAt,
    }));
  }

  updateCursor(clientId, cursor) {
    if (this.presence.has(clientId)) {
      this.presence.get(clientId).updateCursor(cursor);
      return true;
    }
    return false;
  }

  updateActivity(clientId) {
    if (this.presence.has(clientId)) {
      this.presence.get(clientId).updateActivity();
      this.lastActivityAt = Date.now();
      return true;
    }
    return false;
  }

  broadcast(message, excludeClientId = null) {
    const activeConnections = [];

    for (const [clientId, ws] of this.connections) {
      if (clientId === excludeClientId) continue;
      if (ws.readyState === 1) {
        // WebSocket.OPEN
        activeConnections.push({ clientId, ws });
      }
    }

    return activeConnections;
  }

  applyRateLimit(clientId) {
    const now = Date.now();
    const limiter = this.clientRateLimits.get(clientId);

    if (!limiter) {
      return { allowed: false, reason: 'Client not in rate limit tracking' };
    }

    // Clean old timestamps
    limiter.ops = limiter.ops.filter((ts) => now - ts < this.rateLimitConfig.windowMs);

    // Check if backpressured
    if (limiter.backpressured && limiter.ops.length === 0) {
      limiter.backpressured = false;
    }

    if (limiter.backpressured) {
      return { allowed: false, reason: 'Backpressured', backpressured: true };
    }

    // Check window limit
    if (limiter.ops.length >= this.rateLimitConfig.maxOpsPerWindow) {
      return { allowed: false, reason: 'Rate limit exceeded' };
    }

    // Check backpressure threshold (room-wide)
    const queueDepth = this.getQueueDepth();
    if (queueDepth > this.rateLimitConfig.backpressureThreshold) {
      limiter.backpressured = true;
      return {
        allowed: false,
        reason: 'Room backpressured',
        backpressured: true,
      };
    }

    limiter.ops.push(now);
    return { allowed: true };
  }

  getQueueDepth() {
    let total = 0;
    for (const limiter of this.clientRateLimits.values()) {
      total += limiter.ops.length;
    }
    return total;
  }

  getMetrics() {
    return {
      roomId: this.roomId,
      participantCount: this.connections.size,
      maxParticipants: this.maxParticipants,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      queueDepth: this.getQueueDepth(),
      uptime: Date.now() - this.createdAt,
    };
  }

  isEmpty() {
    return this.connections.size === 0;
  }

  isExpired() {
    return Date.now() - this.lastActivityAt > this.options.ttlMs;
  }
}

class RoomManagerService {
  constructor() {
    this.rooms = new Map();
    this.clientToRoom = new Map(); // clientId -> roomId
    this.userIdToClients = new Map(); // userId -> Set<clientId>
    this.cleanupInterval = null;
  }

  initializeCleanup(intervalMs = 60000) {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredRooms();
    }, intervalMs);

    logger.info('Room cleanup initialized', { intervalMs });
  }

  createRoom(roomId, maxParticipants = 50, options = {}) {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId);
    }

    const room = new Room(roomId, maxParticipants, options);
    this.rooms.set(roomId, room);

    logger.info('Room created', { roomId, maxParticipants });
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  joinRoom(roomId, clientId, ws, userId, maxParticipants = 50, options = {}) {
    let room = this.getRoom(roomId);
    if (!room) {
      room = this.createRoom(roomId, maxParticipants, options);
    }

    const result = room.addConnection(clientId, ws, userId);

    this.clientToRoom.set(clientId, roomId);

    if (!this.userIdToClients.has(userId)) {
      this.userIdToClients.set(userId, new Set());
    }
    this.userIdToClients.get(userId).add(clientId);

    return result;
  }

  leaveRoom(roomId, clientId) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, reason: 'Room not found' };
    }

    const userId = room.clientIdToUserId.get(clientId);
    const result = room.removeConnection(clientId);

    this.clientToRoom.delete(clientId);

    if (userId && this.userIdToClients.has(userId)) {
      this.userIdToClients.get(userId).delete(clientId);
      if (this.userIdToClients.get(userId).size === 0) {
        this.userIdToClients.delete(userId);
      }
    }

    // Clean up empty room
    if (result.isEmpty) {
      this.rooms.delete(roomId);
      logger.info('Empty room cleaned up', { roomId });
    }

    return result;
  }

  getClientRooms(clientId) {
    const roomId = this.clientToRoom.get(clientId);
    return roomId ? [roomId] : [];
  }

  getUserRooms(userId) {
    const clientIds = this.userIdToClients.get(userId) || new Set();
    const roomIds = new Set();

    for (const clientId of clientIds) {
      const roomId = this.clientToRoom.get(clientId);
      if (roomId) {
        roomIds.add(roomId);
      }
    }

    return Array.from(roomIds);
  }

  cleanupExpiredRooms() {
    const expiredRooms = [];

    for (const [roomId, room] of this.rooms) {
      if (room.isEmpty() && room.isExpired()) {
        expiredRooms.push(roomId);
      }
    }

    for (const roomId of expiredRooms) {
      this.rooms.delete(roomId);
      logger.info('Expired room cleaned up', { roomId });
    }

    return expiredRooms;
  }

  getStats() {
    const stats = {
      totalRooms: this.rooms.size,
      totalClients: this.clientToRoom.size,
      totalUsers: this.userIdToClients.size,
      rooms: Array.from(this.rooms.values()).map((room) => room.getMetrics()),
    };

    return stats;
  }

  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      logger.info('Room manager cleanup interval cleared');
    }
  }
}

module.exports = new RoomManagerService();
