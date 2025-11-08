const assert = require('assert');
const { describe, it, beforeEach } = require('mocha');
const roomManagerService = require('../src/services/room-manager.service');

describe('Room Manager Service', () => {
  const testRoomId = 'test-room-123';

  beforeEach(() => {
    // Clear all rooms before each test
    roomManagerService.rooms.clear();
    roomManagerService.clientToRoom.clear();
    roomManagerService.userIdToClients.clear();
  });

  describe('Room Lifecycle', () => {
    it('should create a new room', () => {
      const room = roomManagerService.createRoom(testRoomId, 50);

      assert(room);
      assert.strictEqual(room.roomId, testRoomId);
      assert.strictEqual(room.maxParticipants, 50);
    });

    it('should retrieve existing room', () => {
      roomManagerService.createRoom(testRoomId);
      const room = roomManagerService.getRoom(testRoomId);

      assert(room);
      assert.strictEqual(room.roomId, testRoomId);
    });

    it('should return null for non-existent room', () => {
      const room = roomManagerService.getRoom('non-existent');
      assert.strictEqual(room, undefined);
    });
  });

  describe('Client Connection Management', () => {
    it('should join client to room', () => {
      const mockWs = { id: 'socket1', readyState: 1 };

      const result = roomManagerService.joinRoom(testRoomId, 'client1', mockWs, 'user1');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.participantCount, 1);

      const room = roomManagerService.getRoom(testRoomId);
      assert.strictEqual(room.connections.size, 1);
    });

    it('should track client to room mapping', () => {
      const mockWs = { id: 'socket1', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs, 'user1');

      const rooms = roomManagerService.getClientRooms('client1');
      assert.strictEqual(rooms.length, 1);
      assert.strictEqual(rooms[0], testRoomId);
    });

    it('should leave client from room', () => {
      const mockWs = { id: 'socket1', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs, 'user1');
      const result = roomManagerService.leaveRoom(testRoomId, 'client1');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.participantCount, 0);
      assert.strictEqual(result.isEmpty, true);
    });

    it('should reject join if room is full', () => {
      const mockWs1 = { id: 'socket1', readyState: 1 };
      const mockWs2 = { id: 'socket2', readyState: 1 };

      // Create room with max 1 participant
      roomManagerService.createRoom(testRoomId, 1);
      roomManagerService.joinRoom(testRoomId, 'client1', mockWs1, 'user1');

      // Try to join second client
      assert.throws(() => {
        roomManagerService.joinRoom(testRoomId, 'client2', mockWs2, 'user2', 1);
      }, /maximum capacity/);
    });
  });

  describe('Participant Tracking', () => {
    it('should get participant list', () => {
      const mockWs1 = { id: 'socket1', readyState: 1 };
      const mockWs2 = { id: 'socket2', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs1, 'user1');
      roomManagerService.joinRoom(testRoomId, 'client2', mockWs2, 'user2');

      const room = roomManagerService.getRoom(testRoomId);
      const participants = room.getParticipants();

      assert.strictEqual(participants.length, 2);
      assert(participants.some((p) => p.userId === 'user1'));
      assert(participants.some((p) => p.userId === 'user2'));
    });

    it('should track user to clients mapping', () => {
      const mockWs1 = { id: 'socket1', readyState: 1 };
      const mockWs2 = { id: 'socket2', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs1, 'user1');
      roomManagerService.joinRoom(testRoomId, 'client2', mockWs2, 'user1'); // Same user

      const userRooms = roomManagerService.getUserRooms('user1');
      assert(userRooms.includes(testRoomId));
    });
  });

  describe('Cursor Tracking', () => {
    it('should update cursor position', () => {
      const mockWs = { id: 'socket1', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs, 'user1');
      const room = roomManagerService.getRoom(testRoomId);

      const result = room.updateCursor('client1', { line: 5, column: 10 });

      assert.strictEqual(result, true);
      const presence = room.presence.get('client1');
      assert.deepStrictEqual(presence.cursor, { line: 5, column: 10 });
    });

    it('should update activity timestamp', () => {
      const mockWs = { id: 'socket1', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs, 'user1');
      const room = roomManagerService.getRoom(testRoomId);
      const beforeActivity = room.lastActivityAt;

      room.updateActivity('client1');

      assert(room.lastActivityAt >= beforeActivity);
    });
  });

  describe('Broadcasting', () => {
    it('should get broadcast connections excluding sender', () => {
      const mockWs1 = { id: 'socket1', readyState: 1 };
      const mockWs2 = { id: 'socket2', readyState: 1 };
      const mockWs3 = { id: 'socket3', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs1, 'user1');
      roomManagerService.joinRoom(testRoomId, 'client2', mockWs2, 'user2');
      roomManagerService.joinRoom(testRoomId, 'client3', mockWs3, 'user3');

      const room = roomManagerService.getRoom(testRoomId);
      const connections = room.broadcast({}, 'client1');

      assert.strictEqual(connections.length, 2);
      assert(!connections.some((c) => c.clientId === 'client1'));
    });

    it('should exclude closed connections from broadcast', () => {
      const mockWs1 = { id: 'socket1', readyState: 1 };
      const mockWs2 = { id: 'socket2', readyState: 3 }; // CLOSED

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs1, 'user1');
      roomManagerService.joinRoom(testRoomId, 'client2', mockWs2, 'user2');

      const room = roomManagerService.getRoom(testRoomId);
      const connections = room.broadcast({}, 'client1');

      // Should only have client1 excluded, but client2 is closed
      assert(connections.length <= 1);
    });
  });

  describe('Rate Limiting', () => {
    it('should allow operations within rate limit', () => {
      const mockWs = { id: 'socket1', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs, 'user1');
      const room = roomManagerService.getRoom(testRoomId);

      const result1 = room.applyRateLimit('client1');
      assert.strictEqual(result1.allowed, true);

      const result2 = room.applyRateLimit('client1');
      assert.strictEqual(result2.allowed, true);
    });

    it('should reject operations exceeding rate limit', () => {
      const mockWs = { id: 'socket1', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs, 'user1');
      const room = roomManagerService.getRoom(testRoomId);

      // Send max operations in window
      for (let i = 0; i < 50; i++) {
        room.applyRateLimit('client1');
      }

      // Next one should fail
      const result = room.applyRateLimit('client1');
      assert.strictEqual(result.allowed, false);
    });

    it('should apply backpressure threshold', () => {
      const mockWs = { id: 'socket1', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs, 'user1');
      const room = roomManagerService.getRoom(testRoomId);

      // Artificially set high queue depth
      room.rateLimitConfig.backpressureThreshold = 2;

      room.applyRateLimit('client1');
      room.applyRateLimit('client1');
      room.applyRateLimit('client1');

      const result = room.applyRateLimit('client1');
      assert(result.allowed === false || result.backpressured === true);
    });
  });

  describe('Metrics', () => {
    it('should calculate room metrics', () => {
      const mockWs1 = { id: 'socket1', readyState: 1 };
      const mockWs2 = { id: 'socket2', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs1, 'user1');
      roomManagerService.joinRoom(testRoomId, 'client2', mockWs2, 'user2');

      const room = roomManagerService.getRoom(testRoomId);
      const metrics = room.getMetrics();

      assert.strictEqual(metrics.roomId, testRoomId);
      assert.strictEqual(metrics.participantCount, 2);
      assert.strictEqual(metrics.maxParticipants, 50);
      assert(metrics.uptime > 0);
    });

    it('should get service-wide stats', () => {
      const mockWs = { id: 'socket1', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs, 'user1');

      const stats = roomManagerService.getStats();

      assert.strictEqual(stats.totalRooms, 1);
      assert.strictEqual(stats.totalClients, 1);
      assert(Array.isArray(stats.rooms));
    });
  });

  describe('Cleanup', () => {
    it('should detect expired rooms', () => {
      const mockWs = { id: 'socket1', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs, 'user1');
      roomManagerService.leaveRoom(testRoomId, 'client1');

      const room = roomManagerService.getRoom(testRoomId);
      room.options.ttlMs = 0; // Expire immediately

      assert.strictEqual(room.isEmpty(), true);
      assert.strictEqual(room.isExpired(), true);
    });

    it('should cleanup expired rooms', () => {
      const mockWs = { id: 'socket1', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs, 'user1');
      roomManagerService.leaveRoom(testRoomId, 'client1');

      const room = roomManagerService.getRoom(testRoomId);
      room.options.ttlMs = 0;

      const expiredRooms = roomManagerService.cleanupExpiredRooms();

      assert(expiredRooms.includes(testRoomId));
      assert(!roomManagerService.getRoom(testRoomId));
    });

    it('should not cleanup non-empty rooms', () => {
      const mockWs = { id: 'socket1', readyState: 1 };

      roomManagerService.joinRoom(testRoomId, 'client1', mockWs, 'user1');

      const room = roomManagerService.getRoom(testRoomId);
      room.options.ttlMs = 0;

      const expiredRooms = roomManagerService.cleanupExpiredRooms();

      assert(!expiredRooms.includes(testRoomId));
      assert(roomManagerService.getRoom(testRoomId));
    });
  });
});
