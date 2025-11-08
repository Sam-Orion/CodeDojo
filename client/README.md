# CodeDojo Client

Frontend for CodeDojo - a real-time collaborative IDE built with Monaco Editor and WebSockets.

## Overview

The client provides:

- Monaco Editor integration for code editing
- Real-time WebSocket connection for collaborative features
- Room-based session joining
- Cursor position preservation on remote changes
- Tailwind CSS styling via CDN

## Development

### Installation

```bash
npm install
```

### Running Locally

The client is served by the server at http://localhost:3000.

To develop the client:

```bash
npm run dev
```

### Building & Testing

```bash
npm run build
npm run test
npm run lint
npm run format
```

## Features

- **Monaco Editor**: Full-featured code editor with syntax highlighting and language support
- **Real-time Collaboration**: All edits broadcast to other connected clients in the same room
- **Cursor Preservation**: Your cursor position is maintained when receiving remote updates
- **Room Sessions**: Join sessions by entering a Room ID

## Architecture

- **Static Assets**: Served from `src/public/`
- **Monaco Editor**: Loaded via CDN from jsDelivr
- **Tailwind CSS**: Styling via CDN
- **WebSocket Client**: Real-time connection to the server

## Environment Variables

The client uses environment variables prefixed with `VITE_`:

- `VITE_API_URL`: API base URL (default: http://localhost:3000/api)
- `VITE_WS_URL`: WebSocket URL (default: ws://localhost:3000)
