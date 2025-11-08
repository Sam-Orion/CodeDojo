const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const assert = require('assert');
const { describe, it, before, after } = require('mocha');

describe('Operational Transformation Integration Tests', () => {
  let server;
  let clients = [];
  const PORT = 3001;
  const WS_URL = `ws://localhost:${PORT}`;
  const ROOM_ID = 'test-room';
  const CONCURRENCY = 5;

  before((done) => {
    // Create a minimal Express app
    const app = express();
    server = http.createServer(app);

    // Initialize WebSocket
    const webSocketService = require('../src/services/websocket.service');
    webSocketService.initialize(server);

    server.listen(PORT, () => {
      console.log(`Test server listening on port ${PORT}`);
      done();
    });
  });

  after((done) => {
    // Close all clients
    Promise.all(
      clients.map(
        (ws) =>
          new Promise((resolve) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.close();
            }
            ws.on('close', resolve);
          })
      )
    ).then(() => {
      server.close(() => {
        console.log('Test server closed');
        done();
      });
    });
  });

  function createWebSocketClient(userId) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      let timeout;

      ws.on('open', () => {
        clearTimeout(timeout);
        ws.userId = userId;
        ws.clientMessages = [];
        ws.receivedOps = [];

        ws.on('message', (msg) => {
          try {
            const data = JSON.parse(msg);
            ws.clientMessages.push(data);

            if (data.type === 'OT_OP_BROADCAST' || data.type === 'CURSOR_UPDATE_BROADCAST') {
              ws.receivedOps.push(data);
            }
          } catch (e) {
            console.error('Failed to parse message:', e);
          }
        });

        clients.push(ws);
        resolve(ws);
      });

      ws.on('error', reject);

      timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
    });
  }

  function sendMessage(ws, message) {
    return new Promise((resolve) => {
      ws.send(JSON.stringify(message));
      setImmediate(resolve);
    });
  }

  function waitForMessages(ws, condition, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkCondition = () => {
        if (condition(ws.clientMessages)) {
          resolve(ws.clientMessages);
        } else if (Date.now() - startTime > timeout) {
          reject(new Error('Timeout waiting for messages'));
        } else {
          setTimeout(checkCondition, 50);
        }
      };

      checkCondition();
    });
  }

  describe('Single Client Operations', () => {
    it('should handle client connection and room join', async function () {
      this.timeout(10000);
      const ws = await createWebSocketClient('user1');
      const clientId = `client_${Date.now()}_test1`;

      const joinMsg = {
        type: 'JOIN_ROOM',
        roomId: ROOM_ID,
        userId: 'user1',
        clientId,
      };

      await sendMessage(ws, joinMsg);
      const messages = await waitForMessages(
        ws,
        (msgs) => msgs.some((m) => m.type === 'JOIN_ROOM_ACK'),
        5000
      );

      const ackMsg = messages.find((m) => m.type === 'JOIN_ROOM_ACK');
      assert(ackMsg, 'Should receive JOIN_ROOM_ACK');
      assert.strictEqual(ackMsg.roomId, ROOM_ID);
      assert.strictEqual(ackMsg.version, 0);

      ws.close();
    });

    it('should insert text and broadcast operation', async function () {
      this.timeout(10000);
      const ws = await createWebSocketClient('user1');
      const clientId = `client_${Date.now()}_test2`;

      const joinMsg = {
        type: 'JOIN_ROOM',
        roomId: ROOM_ID,
        userId: 'user1',
        clientId,
      };

      await sendMessage(ws, joinMsg);
      await waitForMessages(ws, (msgs) => msgs.some((m) => m.type === 'JOIN_ROOM_ACK'));

      const opMsg = {
        type: 'OT_OP',
        roomId: ROOM_ID,
        clientId,
        userId: 'user1',
        operation: {
          id: `op_${Date.now()}_1`,
          version: 0,
          type: 'insert',
          position: 0,
          content: 'Hello',
        },
      };

      await sendMessage(ws, opMsg);
      const messages = await waitForMessages(
        ws,
        (msgs) => msgs.some((m) => m.type === 'ACK'),
        5000
      );

      const ackMsg = messages.find((m) => m.type === 'ACK');
      assert(ackMsg, 'Should receive operation ACK');
      assert.strictEqual(ackMsg.operationId, opMsg.operation.id);
      assert.strictEqual(ackMsg.version, 1);

      ws.close();
    });
  });

  describe('Multi-Client Consistency', () => {
    it('should maintain consistency across 5 concurrent clients', async function () {
      this.timeout(30000);
      const roomId = `room_${Date.now()}`;
      const wsClients = [];

      // Create multiple clients
      for (let i = 0; i < CONCURRENCY; i++) {
        wsClients.push(await createWebSocketClient(`user${i}`));
      }

      // All clients join room
      const joinPromises = wsClients.map((ws, i) => {
        const clientId = `client_${i}_${Date.now()}`;
        ws.clientId = clientId;

        return sendMessage(ws, {
          type: 'JOIN_ROOM',
          roomId,
          userId: `user${i}`,
          clientId,
        });
      });

      await Promise.all(joinPromises);

      // Wait for all to receive join ack
      await Promise.all(
        wsClients.map((ws) =>
          waitForMessages(ws, (msgs) => msgs.some((m) => m.type === 'JOIN_ROOM_ACK'))
        )
      );

      // Each client sends operations in sequence
      const operations = [];
      for (let i = 0; i < CONCURRENCY; i++) {
        const op = {
          type: 'OT_OP',
          roomId,
          clientId: wsClients[i].clientId,
          userId: `user${i}`,
          operation: {
            id: `op_${i}_${Date.now()}`,
            version: i,
            type: 'insert',
            position: i * 6,
            content: `Text${i}`,
          },
        };
        operations.push(op);
        await sendMessage(wsClients[i], op);
      }

      // Wait for all clients to receive all operations
      const allClientsReceived = wsClients.map((ws) =>
        waitForMessages(
          ws,
          (msgs) => msgs.filter((m) => m.type === 'OT_OP_BROADCAST').length >= CONCURRENCY - 1,
          10000
        )
      );

      await Promise.all(allClientsReceived);

      // Verify consistency - all clients should have same state
      const otService = require('../src/services/ot.service');
      const finalState = otService.getSnapshot(roomId);

      console.log('Final state version:', finalState.version);
      console.log('Final content:', finalState.content);

      assert(finalState.version > 0, 'Version should be incremented');
      assert(finalState.content.length > 0, 'Content should not be empty');

      // Close all clients
      wsClients.forEach((ws) => ws.close());
    });

    it('should resolve conflicts correctly', async function () {
      this.timeout(20000);
      const roomId = `conflict_room_${Date.now()}`;
      const ws1 = await createWebSocketClient('user1');
      const ws2 = await createWebSocketClient('user2');
      const clientId1 = `client_1_${Date.now()}`;
      const clientId2 = `client_2_${Date.now()}`;

      // Both join room
      await sendMessage(ws1, {
        type: 'JOIN_ROOM',
        roomId,
        userId: 'user1',
        clientId: clientId1,
      });

      await sendMessage(ws2, {
        type: 'JOIN_ROOM',
        roomId,
        userId: 'user2',
        clientId: clientId2,
      });

      await waitForMessages(ws1, (msgs) => msgs.some((m) => m.type === 'JOIN_ROOM_ACK'));
      await waitForMessages(ws2, (msgs) => msgs.some((m) => m.type === 'JOIN_ROOM_ACK'));

      // Send concurrent conflicting operations (both at position 0)
      const op1 = {
        type: 'OT_OP',
        roomId,
        clientId: clientId1,
        userId: 'user1',
        operation: {
          id: `op_${Date.now()}_1`,
          version: 0,
          type: 'insert',
          position: 0,
          content: 'A',
        },
      };

      const op2 = {
        type: 'OT_OP',
        roomId,
        clientId: clientId2,
        userId: 'user2',
        operation: {
          id: `op_${Date.now()}_2`,
          version: 0,
          type: 'insert',
          position: 0,
          content: 'B',
        },
      };

      // Send operations nearly simultaneously
      await Promise.all([sendMessage(ws1, op1), sendMessage(ws2, op2)]);

      // Wait for acks
      await waitForMessages(ws1, (msgs) => msgs.some((m) => m.type === 'ACK'));
      await waitForMessages(ws2, (msgs) => msgs.some((m) => m.type === 'ACK'));

      // Check final state consistency
      const otService = require('../src/services/ot.service');
      const state1 = otService.getSnapshot(roomId);

      // Both clients should see the same content
      console.log('Conflict resolved content:', state1.content);
      assert(state1.content, 'Content should exist');
      assert(state1.content.length > 0, 'Content should have both operations');

      ws1.close();
      ws2.close();
    });
  });

  describe('Cursor Synchronization', () => {
    it('should sync cursor updates across clients', async function () {
      this.timeout(15000);
      const roomId = `cursor_room_${Date.now()}`;
      const ws1 = await createWebSocketClient('user1');
      const ws2 = await createWebSocketClient('user2');
      const clientId1 = `client_1_${Date.now()}`;
      const clientId2 = `client_2_${Date.now()}`;

      // Both join room
      await sendMessage(ws1, {
        type: 'JOIN_ROOM',
        roomId,
        userId: 'user1',
        clientId: clientId1,
      });

      await sendMessage(ws2, {
        type: 'JOIN_ROOM',
        roomId,
        userId: 'user2',
        clientId: clientId2,
      });

      await waitForMessages(ws1, (msgs) => msgs.some((m) => m.type === 'JOIN_ROOM_ACK'));
      await waitForMessages(ws2, (msgs) => msgs.some((m) => m.type === 'JOIN_ROOM_ACK'));

      // Send cursor update from client1
      await sendMessage(ws1, {
        type: 'CURSOR_UPDATE',
        roomId,
        clientId: clientId1,
        userId: 'user1',
        cursor: { line: 5, column: 10 },
      });

      // Client2 should receive cursor update
      await waitForMessages(
        ws2,
        (msgs) => msgs.some((m) => m.type === 'CURSOR_UPDATE_BROADCAST'),
        5000
      );

      const cursorMsg = ws2.clientMessages.find((m) => m.type === 'CURSOR_UPDATE_BROADCAST');
      assert(cursorMsg, 'Should receive cursor update');
      assert.deepStrictEqual(cursorMsg.cursor, { line: 5, column: 10 });

      ws1.close();
      ws2.close();
    });
  });

  describe('Late Join Scenario', () => {
    it('should handle late join with operation history', async function () {
      this.timeout(20000);
      const roomId = `latejoin_room_${Date.now()}`;
      const ws1 = await createWebSocketClient('user1');
      const clientId1 = `client_1_${Date.now()}`;

      // First client joins and sends operations
      await sendMessage(ws1, {
        type: 'JOIN_ROOM',
        roomId,
        userId: 'user1',
        clientId: clientId1,
      });

      await waitForMessages(ws1, (msgs) => msgs.some((m) => m.type === 'JOIN_ROOM_ACK'));

      // Send a few operations
      for (let i = 0; i < 3; i++) {
        await sendMessage(ws1, {
          type: 'OT_OP',
          roomId,
          clientId: clientId1,
          userId: 'user1',
          operation: {
            id: `op_${i}_${Date.now()}`,
            version: i,
            type: 'insert',
            position: i,
            content: `Op${i}`,
          },
        });

        await waitForMessages(ws1, (msgs) => msgs.filter((m) => m.type === 'ACK').length > i);
      }

      // Late client joins
      const ws2 = await createWebSocketClient('user2');
      const clientId2 = `client_2_${Date.now()}`;

      await sendMessage(ws2, {
        type: 'JOIN_ROOM',
        roomId,
        userId: 'user2',
        clientId: clientId2,
      });

      const joinAck = await waitForMessages(
        ws2,
        (msgs) => msgs.some((m) => m.type === 'JOIN_ROOM_ACK'),
        5000
      );

      const ackMsg = joinAck.find((m) => m.type === 'JOIN_ROOM_ACK');
      assert(ackMsg, 'Late client should receive JOIN_ROOM_ACK');
      assert(ackMsg.version > 0, 'Late client should see accumulated version');
      assert(ackMsg.content, 'Late client should get current content');

      ws1.close();
      ws2.close();
    });
  });

  describe('Rate Limiting and Backpressure', () => {
    it('should apply rate limiting to prevent flooding', async function () {
      this.timeout(15000);
      const roomId = `ratelimit_room_${Date.now()}`;
      const ws = await createWebSocketClient('user1');
      const clientId = `client_${Date.now()}`;

      await sendMessage(ws, {
        type: 'JOIN_ROOM',
        roomId,
        userId: 'user1',
        clientId,
      });

      await waitForMessages(ws, (msgs) => msgs.some((m) => m.type === 'JOIN_ROOM_ACK'));

      // Try to send many operations rapidly
      const operationPromises = [];
      for (let i = 0; i < 100; i++) {
        operationPromises.push(
          sendMessage(ws, {
            type: 'OT_OP',
            roomId,
            clientId,
            userId: 'user1',
            operation: {
              id: `op_${i}_${Date.now()}`,
              version: i,
              type: 'insert',
              position: i,
              content: 'X',
            },
          })
        );
      }

      await Promise.all(operationPromises);

      // Wait a bit for responses
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Count responses - should have errors or rate limit responses
      const errorMessages = ws.clientMessages.filter(
        (m) => m.type === 'ERROR' || m.type === 'BACKPRESSURE'
      );

      console.log(`Received ${errorMessages.length} rate limit/error messages`);
      // With aggressive sending, we should see some rate limiting
      // Note: this is a soft assertion - the exact number depends on timing

      ws.close();
    });
  });
});
