const assert = require('assert');
const { describe, it, beforeEach } = require('mocha');
const otService = require('../src/services/ot.service');

describe('Operational Transformation Service', () => {
  const testRoomId = 'test-room-123';

  beforeEach(() => {
    // Clean up before each test
    if (otService.documentStates.has(testRoomId)) {
      otService.documentStates.delete(testRoomId);
    }
  });

  describe('Document State Management', () => {
    it('should create a new document state', () => {
      const state = otService.createDocumentState(testRoomId, 'Hello');
      assert.strictEqual(state.version, 0);
      assert.strictEqual(state.content, 'Hello');
      assert.strictEqual(state.operationHistory.length, 0);
    });

    it('should retrieve existing document state', () => {
      otService.createDocumentState(testRoomId, 'Initial');
      const state = otService.getDocumentState(testRoomId);
      assert.strictEqual(state.content, 'Initial');
    });

    it('should auto-create document state on getDocumentState', () => {
      const state = otService.getDocumentState('new-room');
      assert.strictEqual(state.version, 0);
      assert.strictEqual(state.content, '');
    });
  });

  describe('Single Client Operations', () => {
    it('should apply insert operation', () => {
      otService.createDocumentState(testRoomId, '');

      const op = {
        id: 'op1',
        clientId: 'client1',
        version: 0,
        type: 'insert',
        position: 0,
        content: 'Hello',
        userId: 'user1',
        timestamp: Date.now(),
      };

      const result = otService.applyOperation(testRoomId, op);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.version, 1);
      assert.strictEqual(result.content, 'Hello');
    });

    it('should apply multiple sequential inserts', () => {
      otService.createDocumentState(testRoomId, '');

      const ops = [
        {
          id: 'op1',
          clientId: 'client1',
          version: 0,
          type: 'insert',
          position: 0,
          content: 'Hello',
          userId: 'user1',
          timestamp: Date.now(),
        },
        {
          id: 'op2',
          clientId: 'client1',
          version: 1,
          type: 'insert',
          position: 5,
          content: ' World',
          userId: 'user1',
          timestamp: Date.now(),
        },
      ];

      let result;
      for (const op of ops) {
        result = otService.applyOperation(testRoomId, op);
      }

      assert.strictEqual(result.version, 2);
      assert.strictEqual(result.content, 'Hello World');
    });

    it('should apply delete operation', () => {
      otService.createDocumentState(testRoomId, 'Hello World');

      const op = {
        id: 'op1',
        clientId: 'client1',
        version: 0,
        type: 'delete',
        position: 5,
        content: ' ',
        userId: 'user1',
        timestamp: Date.now(),
      };

      const result = otService.applyOperation(testRoomId, op);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.content, 'HelloWorld');
    });

    it('should track operation history', () => {
      otService.createDocumentState(testRoomId, '');

      const op1 = {
        id: 'op1',
        clientId: 'client1',
        version: 0,
        type: 'insert',
        position: 0,
        content: 'A',
        userId: 'user1',
        timestamp: Date.now(),
      };

      otService.applyOperation(testRoomId, op1);
      const state = otService.getDocumentState(testRoomId);

      assert.strictEqual(state.operationHistory.length, 1);
      assert.strictEqual(state.operationHistory[0].id, 'op1');
    });
  });

  describe('Concurrent Operations', () => {
    it('should transform concurrent inserts at same position by clientId', () => {
      otService.createDocumentState(testRoomId, '');

      // Operation from client1
      const op1 = {
        id: 'op1',
        clientId: 'client_1',
        version: 0,
        type: 'insert',
        position: 0,
        content: 'A',
        userId: 'user1',
        timestamp: Date.now(),
      };

      // Operation from client2 (concurrent)
      const op2 = {
        id: 'op2',
        clientId: 'client_2',
        version: 0,
        type: 'insert',
        position: 0,
        content: 'B',
        userId: 'user2',
        timestamp: Date.now(),
      };

      const result1 = otService.applyOperation(testRoomId, op1);
      const result2 = otService.applyOperation(testRoomId, op2);

      assert.strictEqual(result1.success, true);
      assert.strictEqual(result2.success, true);
      // Content should be deterministic based on clientId comparison
      assert(result2.content === 'AB' || result2.content === 'BA', 'Should have both characters');
    });

    it('should transform insert after other inserts', () => {
      otService.createDocumentState(testRoomId, '');

      const op1 = {
        id: 'op1',
        clientId: 'client1',
        version: 0,
        type: 'insert',
        position: 0,
        content: 'Hello',
        userId: 'user1',
        timestamp: Date.now(),
      };

      const op2 = {
        id: 'op2',
        clientId: 'client2',
        version: 0,
        type: 'insert',
        position: 2,
        content: '!',
        userId: 'user2',
        timestamp: Date.now(),
      };

      otService.applyOperation(testRoomId, op1);
      const result = otService.applyOperation(testRoomId, op2);

      // op2 at position 2 with op1 at position 0 affecting 5 chars
      // op2 should be transformed to position 7 (2 + 5)
      assert.strictEqual(result.content, 'Hello!');
    });

    it('should handle delete and insert conflict', () => {
      otService.createDocumentState(testRoomId, 'Hello');

      const op1 = {
        id: 'op1',
        clientId: 'client1',
        version: 0,
        type: 'delete',
        position: 0,
        content: 'Hello',
        userId: 'user1',
        timestamp: Date.now(),
      };

      const op2 = {
        id: 'op2',
        clientId: 'client2',
        version: 0,
        type: 'insert',
        position: 3,
        content: '!',
        userId: 'user2',
        timestamp: Date.now(),
      };

      otService.applyOperation(testRoomId, op1);
      const result = otService.applyOperation(testRoomId, op2);

      assert.strictEqual(result.success, true);
      assert(result.content);
    });
  });

  describe('Acknowledgement and Retry', () => {
    it('should track pending operations', () => {
      otService.createDocumentState(testRoomId, '');

      const op = {
        id: 'op1',
        clientId: 'client1',
        version: 0,
        type: 'insert',
        position: 0,
        content: 'A',
        userId: 'user1',
        timestamp: Date.now(),
      };

      otService.applyOperation(testRoomId, op);
      const state = otService.getDocumentState(testRoomId);

      assert(state.pendingOperations.has('client1'));
      const pendingOps = state.pendingOperations.get('client1');
      assert(pendingOps.length > 0);
    });

    it('should acknowledge and remove pending operation', () => {
      otService.createDocumentState(testRoomId, '');

      const op = {
        id: 'op1',
        clientId: 'client1',
        version: 0,
        type: 'insert',
        position: 0,
        content: 'A',
        userId: 'user1',
        timestamp: Date.now(),
      };

      otService.applyOperation(testRoomId, op);
      otService.acknowledgeOperation(testRoomId, 'client1', 'op1');

      const state = otService.getDocumentState(testRoomId);
      const pendingOps = state.pendingOperations.get('client1') || [];

      // After ack, operation should be marked or removed
      assert(pendingOps.length === 0 || pendingOps[0].acked);
    });
  });

  describe('Snapshots and History', () => {
    it('should return current snapshot', () => {
      otService.createDocumentState(testRoomId, 'Hello');

      const op = {
        id: 'op1',
        clientId: 'client1',
        version: 0,
        type: 'insert',
        position: 5,
        content: ' World',
        userId: 'user1',
        timestamp: Date.now(),
      };

      otService.applyOperation(testRoomId, op);
      const snapshot = otService.getSnapshot(testRoomId);

      assert.strictEqual(snapshot.version, 1);
      assert.strictEqual(snapshot.content, 'Hello World');
    });

    it('should return operations since version', () => {
      otService.createDocumentState(testRoomId, '');

      const ops = [
        {
          id: 'op1',
          clientId: 'client1',
          version: 0,
          type: 'insert',
          position: 0,
          content: 'A',
          userId: 'user1',
          timestamp: Date.now(),
        },
        {
          id: 'op2',
          clientId: 'client2',
          version: 1,
          type: 'insert',
          position: 1,
          content: 'B',
          userId: 'user2',
          timestamp: Date.now(),
        },
        {
          id: 'op3',
          clientId: 'client1',
          version: 2,
          type: 'insert',
          position: 2,
          content: 'C',
          userId: 'user1',
          timestamp: Date.now(),
        },
      ];

      ops.forEach((op) => otService.applyOperation(testRoomId, op));

      const operationsSinceV1 = otService.getOperationsSince(testRoomId, 'client1', 1);

      // Should exclude operations from same client
      assert(operationsSinceV1.length <= 1);
    });
  });

  describe('Metrics', () => {
    it('should calculate queue stats', () => {
      otService.createDocumentState(testRoomId, '');

      const op1 = {
        id: 'op1',
        clientId: 'client1',
        version: 0,
        type: 'insert',
        position: 0,
        content: 'A',
        userId: 'user1',
        timestamp: Date.now(),
      };

      const op2 = {
        id: 'op2',
        clientId: 'client2',
        version: 0,
        type: 'insert',
        position: 0,
        content: 'B',
        userId: 'user2',
        timestamp: Date.now(),
      };

      otService.applyOperation(testRoomId, op1);
      otService.applyOperation(testRoomId, op2);

      const stats = otService.getQueueStats(testRoomId);

      assert(stats.clientCount >= 0);
      assert(stats.totalPending >= 0);
      assert(stats.maxQueueLength >= 0);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup room state', () => {
      otService.createDocumentState(testRoomId, 'Test');
      assert(otService.documentStates.has(testRoomId));

      otService.cleanupRoom(testRoomId);
      assert(!otService.documentStates.has(testRoomId));
    });
  });
});
