const { expect } = require('chai');
const WebSocket = require('ws');
const fetch = require('node-fetch');

describe('AI Assistant Integration Tests', function () {
  this.timeout(30000); // 30 second timeout for integration tests

  let ws;
  let baseUrl;
  let testUserId = 'test-user-ai';
  let testSessionId = 'test-session-ai';

  before(async () => {
    // Start server (assuming it's already running for integration tests)
    baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
    const wsUrl = process.env.TEST_WS_URL || 'ws://localhost:3000';

    // Connect WebSocket
    ws = new WebSocket(wsUrl);

    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
      setTimeout(reject, 5000);
    });
  });

  after(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  describe('AI Completion via REST API', () => {
    it('should handle completion request without API key', async () => {
      const response = await fetch(`${baseUrl}/api/v1/ai/completion/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': testUserId,
        },
        body: JSON.stringify({
          userId: testUserId,
          sessionId: testSessionId,
          context: {
            language: 'javascript',
            fileContent: 'const hello = ',
            cursorPosition: 14,
          },
        }),
      });

      // Should fail without user credentials or environment API key
      expect(response.status).to.be.oneOf([400, 500]);
    });

    it('should get available providers', async () => {
      const response = await fetch(`${baseUrl}/api/v1/ai/providers`, {
        headers: {
          'X-User-ID': testUserId,
        },
      });

      expect(response.ok).to.be.true;
      const data = await response.json();
      expect(data).to.have.property('available');
      expect(data).to.have.property('default');
    });

    it('should get cache statistics', async () => {
      const response = await fetch(`${baseUrl}/api/v1/ai/cache/stats`, {
        headers: {
          'X-User-ID': testUserId,
        },
      });

      expect(response.ok).to.be.true;
      const data = await response.json();
      expect(data).to.have.property('size');
      expect(data).to.have.property('maxSize');
    });
  });

  describe('AI Credentials Management', () => {
    let credentialId;

    it('should create credential with test data', async () => {
      const response = await fetch(`${baseUrl}/api/v1/ai/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': testUserId,
        },
        body: JSON.stringify({
          provider: 'openai',
          apiKey: 'sk-test-key-for-integration-test',
          displayName: 'Test Integration Key',
        }),
      });

      expect(response.ok).to.be.true;
      const data = await response.json();
      expect(data).to.have.property('_id');
      expect(data.provider).to.equal('openai');
      expect(data.displayName).to.equal('Test Integration Key');
      expect(data).to.not.have.property('encryptedApiKey');

      credentialId = data._id;
    });

    it('should get user credentials', async () => {
      const response = await fetch(`${baseUrl}/api/v1/ai/credentials`, {
        headers: {
          'X-User-ID': testUserId,
        },
      });

      expect(response.ok).to.be.true;
      const data = await response.json();
      expect(data).to.have.property('credentials');
      expect(data.credentials).to.be.an('array');
      expect(data.credentials.length).to.be.greaterThan(0);
    });

    it('should get credential statistics', async () => {
      const response = await fetch(`${baseUrl}/api/v1/ai/credentials/stats`, {
        headers: {
          'X-User-ID': testUserId,
        },
      });

      expect(response.ok).to.be.true;
      const data = await response.json();
      expect(data).to.have.property('totalCredentials');
      expect(data).to.have.property('activeCredentials');
      expect(data).to.have.property('totalUsage');
      expect(data).to.have.property('byProvider');
    });

    it('should update credential', async () => {
      const response = await fetch(`${baseUrl}/api/v1/ai/credentials/${credentialId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': testUserId,
        },
        body: JSON.stringify({
          displayName: 'Updated Test Key',
          isActive: false,
        }),
      });

      expect(response.ok).to.be.true;
      const data = await response.json();
      expect(data.displayName).to.equal('Updated Test Key');
      expect(data.isActive).to.be.false;
    });

    it('should delete credential', async () => {
      const response = await fetch(`${baseUrl}/api/v1/ai/credentials/${credentialId}`, {
        method: 'DELETE',
        headers: {
          'X-User-ID': testUserId,
        },
      });

      expect(response.ok).to.be.true;
      const data = await response.json();
      expect(data.success).to.be.true;
    });
  });

  describe('AI via WebSocket', () => {
    it('should handle AI completion request', (done) => {
      const message = {
        type: 'AI_COMPLETION_REQUEST',
        userId: testUserId,
        sessionId: testSessionId,
        context: {
          language: 'javascript',
          fileContent: 'const hello = ',
          cursorPosition: 14,
        },
      };

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'AI_COMPLETION_ERROR' || message.type === 'AI_COMPLETION_DONE') {
            if (message.type === 'AI_COMPLETION_ERROR') {
              // Expected to fail without valid API key
              expect(message.error).to.be.a('string');
            }
            done();
          }
        } catch (error) {
          done(error);
        }
      });

      ws.send(JSON.stringify(message));
    });

    it('should handle AI explain request', (done) => {
      const message = {
        type: 'AI_EXPLAIN_REQUEST',
        userId: testUserId,
        sessionId: testSessionId,
        code: 'const x = 1;',
        language: 'javascript',
      };

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'AI_EXPLAIN_ERROR' || message.type === 'AI_EXPLAIN_DONE') {
            if (message.type === 'AI_EXPLAIN_ERROR') {
              // Expected to fail without valid API key
              expect(message.error).to.be.a('string');
            }
            done();
          }
        } catch (error) {
          done(error);
        }
      });

      ws.send(JSON.stringify(message));
    });

    it('should handle AI refactor request', (done) => {
      const message = {
        type: 'AI_REFACTOR_REQUEST',
        userId: testUserId,
        sessionId: testSessionId,
        code: 'function old() { return 1; }',
        language: 'javascript',
        refactorType: 'modernize',
      };

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'AI_REFACTOR_ERROR' || message.type === 'AI_REFACTOR_DONE') {
            if (message.type === 'AI_REFACTOR_ERROR') {
              // Expected to fail without valid API key
              expect(message.error).to.be.a('string');
            }
            done();
          }
        } catch (error) {
          done(error);
        }
      });

      ws.send(JSON.stringify(message));
    });

    it('should handle AI feedback', (done) => {
      const message = {
        type: 'AI_FEEDBACK',
        requestId: 'test-request-id',
        helpful: true,
        rating: 5,
        comment: 'Great suggestion!',
        userId: testUserId,
      };

      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());

          if (response.type === 'AI_FEEDBACK_ACK') {
            expect(response.success).to.be.true;
            done();
          }
        } catch (error) {
          done(error);
        }
      });

      ws.send(JSON.stringify(message));
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid message type', (done) => {
      const message = {
        type: 'INVALID_AI_TYPE',
        userId: testUserId,
        sessionId: testSessionId,
      };

      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());

          if (response.type === 'error') {
            expect(response.message).to.include('Unknown message type');
            done();
          }
        } catch (error) {
          done(error);
        }
      });

      ws.send(JSON.stringify(message));
    });

    it('should handle missing required fields', (done) => {
      const message = {
        type: 'AI_COMPLETION_REQUEST',
        // Missing userId and sessionId
        context: {
          language: 'javascript',
        },
      };

      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());

          if (response.type === 'error') {
            expect(response.message).to.include('Missing required field');
            done();
          }
        } catch (error) {
          done(error);
        }
      });

      ws.send(JSON.stringify(message));
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limiting for rapid requests', (done) => {
      const message = {
        type: 'AI_COMPLETION_REQUEST',
        userId: testUserId,
        sessionId: testSessionId,
        context: {
          language: 'javascript',
          fileContent: 'test',
        },
      };

      let errorReceived = false;

      ws.on('message', (data) => {
        try {
          const response = JSON.parse(data.toString());

          if (response.type === 'AI_COMPLETION_ERROR') {
            if (response.error.includes('Rate limit')) {
              errorReceived = true;
              expect(errorReceived).to.be.true;
              done();
            }
          }
        } catch (error) {
          done(error);
        }
      });

      // Send multiple rapid requests
      for (let i = 0; i < 70; i++) {
        ws.send(JSON.stringify(message));
      }
    });
  });
});
