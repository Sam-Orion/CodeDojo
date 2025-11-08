# CodeDojo Server

Backend server for CodeDojo - a real-time collaborative IDE powered by Express and WebSockets.

## Overview

The server provides:

- HTTP endpoints for serving static assets
- WebSocket server for real-time code synchronization
- Room-based session management with in-memory storage
- Broadcast messaging for collaborative editing

## Development

### Installation

```bash
npm install
```

### Running Locally

```bash
npm run dev
```

The server runs on http://localhost:3000 by default. Set the `PORT` environment variable to change the port.

### Building & Testing

```bash
npm run build
npm run test
npm run lint
npm run format
```

## Architecture

- **Express Server**: HTTP server for static assets and API routes
- **WebSocket Server**: Handles real-time client connections and messaging
- **Room Management**: In-memory storage of collaborative sessions with connected clients and shared content
- **Message Broadcasting**: Synchronizes code changes across all connected clients in a room

## Environment Variables

See `.env.example` at the root of the workspace for available configuration options.

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development, production)
