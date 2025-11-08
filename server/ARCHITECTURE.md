# CodeDojo Server Architecture

## Overview

Production-ready Express 5 backend with modular architecture, MongoDB integration, and WebSocket support for real-time collaboration.

## Directory Structure

```
server/src/
├── app.js                 # Express application configuration
├── server.js              # HTTP/WebSocket server and startup logic
├── config/                # Configuration and environment validation
│   ├── env.js            # Environment schema validation with Zod
│   └── database.js       # MongoDB connection management
├── routes/                # API route definitions
│   ├── index.js          # Route aggregator
│   ├── health.routes.js  # Health check and metrics routes
│   └── auth.routes.js    # Authentication routes (placeholder)
├── controllers/           # Request handlers
│   ├── health.controller.js
│   └── auth.controller.js
├── services/              # Business logic and external integrations
│   └── websocket.service.js  # WebSocket connection and event management
├── models/                # Mongoose models
│   ├── index.js
│   ├── User.js
│   ├── Document.js
│   ├── Room.js
│   └── FileMetadata.js
├── middlewares/           # Express middleware
│   ├── correlationId.js  # Request correlation IDs
│   ├── requestLogger.js  # HTTP request logging
│   ├── metrics.js        # Prometheus metrics collection
│   ├── auth.js           # Authentication/authorization (placeholder)
│   └── errorHandler.js   # Centralized error handling
└── utils/                 # Utility functions
    ├── logger.js         # Winston logger configuration
    ├── asyncHandler.js   # Async route wrapper
    ├── correlationId.js  # Correlation ID utilities
    ├── asyncLocalStorage.js  # AsyncLocalStorage instance
    └── metrics.js        # Prometheus metrics definitions
```

## Core Components

### Configuration (`config/`)

- **env.js**: Validates environment variables using Zod schema
  - Required: `NODE_ENV`, `PORT`, `MONGODB_URI`
  - Optional: OAuth, AWS, AI provider keys, JWT secrets
  - Provides descriptive error messages on startup failures

- **database.js**: MongoDB connection management
  - Mongoose integration with connection pooling
  - Graceful connection/disconnection handling
  - Error and reconnection event logging

### Application Layer (`app.js`)

Express application with security middleware stack:

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Compression**: Response compression
- **JSON/URL-encoded** parsing with 10MB limit
- **Correlation IDs**: Request tracing
- **Request logging**: Structured logging with Winston
- **Metrics collection**: Prometheus metrics
- **Static file serving**: Client assets
- **Error handling**: Centralized error middleware

### Server (`server.js`)

HTTP server with WebSocket support:

- Creates HTTP server from Express app
- Initializes WebSocket service
- Implements graceful shutdown (SIGTERM, SIGINT)
- Database connection on startup
- Unhandled rejection/exception logging

### Models (`models/`)

Mongoose schemas with indexes and timestamps:

1. **User**: Authentication and user profiles
   - Fields: username, email, passwordHash, oauthProvider, role, preferences
   - Indexes: email, username, oauthProvider+oauthId

2. **Document**: Code documents and files
   - Fields: title, content, language, owner, collaborators, version
   - Indexes: owner, room, isPublic, collaborators.user

3. **Room**: Collaboration rooms
   - Fields: name, slug, owner, participants, settings, activeConnections
   - Indexes: slug, owner, isPublic+isActive, participants.user

4. **FileMetadata**: File storage metadata
   - Fields: filename, path, mimeType, size, storageProvider, checksum
   - Indexes: owner, document, room, storageProvider+storageKey

### WebSocket Service (`services/websocket.service.js`)

Real-time collaboration and terminal channels:

- **Connection management**: Client tracking, heartbeat/ping-pong
- **Room-based messaging**: Join/leave, content updates, participant tracking
- **Event routing**:
  - `collaboration:join`, `collaboration:update`, `collaboration:leave`
  - `terminal:input`, `terminal:resize` (placeholders)
- **Metrics**: Active connections, message counts
- **Graceful shutdown**: Closes all connections on server shutdown

### Middleware

1. **correlationId**: Generates/propagates X-Correlation-ID headers
2. **requestLogger**: Logs HTTP requests with duration, status, correlation ID
3. **metrics**: Collects Prometheus metrics (latency, request count)
4. **auth**: JWT/session authentication (placeholder)
5. **errorHandler**: Centralized error responses with stack traces in dev

### Logging (`utils/logger.js`)

Winston logger with:

- Console and file transports (production)
- Structured JSON logging
- Correlation ID injection
- Log levels: error, warn, info, http, debug
- Color-coded console output in development

### Metrics (`utils/metrics.js`)

Prometheus metrics:

- `http_request_duration_seconds`: Request latency histogram
- `http_requests_total`: Total HTTP requests counter
- `ws_connections_active`: Active WebSocket connections gauge
- `ws_messages_total`: WebSocket message counter
- `db_query_duration_seconds`: Database query latency (stub)

### Routes

#### `/api/v1/health`

- `GET /`: Health check endpoint
  - Returns status, uptime, environment, service health
  - Status 200 if healthy, 503 if degraded

- `GET /metrics`: Prometheus metrics endpoint
  - Returns metrics in Prometheus text format

#### `/api/v1/auth` (Placeholder)

- `POST /register`: User registration
- `POST /login`: User login
- `POST /logout`: User logout
- `GET /me`: Get current user
- `POST /refresh`: Refresh authentication token

All auth endpoints return 501 (Not Implemented) until authentication is fully implemented.

## Environment Variables

See `.env.example` for all available configuration options.

Required:

- `MONGODB_URI`: MongoDB connection string

Optional:

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production/test)
- `LOG_LEVEL`: Logging level (error/warn/info/http/debug)
- `CORS_ORIGIN`: CORS allowed origins
- `WS_HEARTBEAT_INTERVAL`: WebSocket ping interval (ms)
- `WS_MAX_PAYLOAD`: Max WebSocket message size (bytes)
- OAuth, AWS, and AI provider credentials

## Running the Server

```bash
# Development
npm run dev

# Production
NODE_ENV=production node src/server.js
```

## Health Check

```bash
curl http://localhost:3000/api/v1/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "development",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "websocket": "healthy"
  }
}
```

## Metrics

Prometheus metrics available at: `http://localhost:3000/api/v1/health/metrics`

## WebSocket Events

### Collaboration Events

**Join Room**

```json
{
  "type": "collaboration:join",
  "roomId": "room123"
}
```

**Update Content**

```json
{
  "type": "collaboration:update",
  "roomId": "room123",
  "content": "console.log('Hello');"
}
```

**Leave Room**

```json
{
  "type": "collaboration:leave",
  "roomId": "room123"
}
```

### Terminal Events (Placeholder)

**Terminal Input**

```json
{
  "type": "terminal:input",
  "command": "ls -la"
}
```

**Terminal Resize**

```json
{
  "type": "terminal:resize",
  "rows": 24,
  "cols": 80
}
```

## Error Handling

All errors are handled by centralized error middleware:

- Operational errors: 4xx status codes
- Programming errors: 5xx status codes
- Stack traces in development only
- Correlation IDs for request tracing

## Graceful Shutdown

The server implements graceful shutdown:

1. Stop accepting new connections
2. Close WebSocket connections
3. Close database connections
4. Exit after 10s timeout

## Future Enhancements

- [ ] JWT/OAuth authentication implementation
- [ ] File upload/storage service
- [ ] Terminal emulation with pty
- [ ] AI-assisted code completion
- [ ] Real-time cursor tracking
- [ ] Code execution sandboxing
- [ ] Document versioning and history
- [ ] User presence and typing indicators
