const assert = require('assert');
const WebSocket = require('ws');
const app = require('../src/app');
const http = require('http');

describe('Terminal Integration Tests', function () {
  this.timeout(30000);

  let httpServer;
  let wsUrl;

  before((done) => {
    const port = 3001;
    httpServer = http.createServer(app);

    httpServer.listen(port, () => {
      wsUrl = `ws://localhost:${port}`;

      const WebSocketService = require('../src/services/websocket.service');
      WebSocketService.initialize(httpServer);

      done();
    });
  });

  after((done) => {
    if (httpServer) {
      httpServer.close(() => {
        done();
      });
    } else {
      done();
    }
  });

  it('should connect via WebSocket', (done) => {
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      ws.close();
      done();
    });

    ws.on('error', (error) => {
      done(error);
    });
  });

  it('should handle terminal capability requests via REST API', (done) => {
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/terminal/capabilities',
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const response = JSON.parse(data);
        assert(response.success);
        assert(response.data);
        assert(response.data.languages);
        assert(response.data.executionModes);
        done();
      });
    });

    req.on('error', (error) => {
      done(error);
    });

    req.end();
  });

  it('should list supported languages via REST API', (done) => {
    const http = require('http');
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/v1/terminal/languages',
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const response = JSON.parse(data);
        assert(response.success);
        assert(response.data);
        assert(Array.isArray(response.data.languages));
        assert(response.data.languages.length >= 8);
        done();
      });
    });

    req.on('error', (error) => {
      done(error);
    });

    req.end();
  });

  it('should validate terminal message format', (done) => {
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          type: 'TERMINAL_CREATE',
          clientId: 'test_client',
          language: 'python',
        })
      );
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === 'TERMINAL_CREATE' || message.type === 'TERMINAL_ERROR') {
        ws.close();
        done();
      }
    });

    ws.on('error', (error) => {
      done(error);
    });
  });

  it('should reject invalid language', (done) => {
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          type: 'TERMINAL_CREATE',
          clientId: 'test_client',
          language: 'invalid_language',
        })
      );
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === 'TERMINAL_ERROR') {
        assert(message.error);
        ws.close();
        done();
      }
    });

    ws.on('error', (error) => {
      done(error);
    });
  });
});
