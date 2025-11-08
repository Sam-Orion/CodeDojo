const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

const clientPublicPath = path.join(__dirname, '..', '..', 'client', 'src', 'public');
app.use(express.static(clientPublicPath));

// Create a WebSocket server and attach it to our existing HTTP server
// This allows both the web page and the WebSocket to be served on the same port.
const wss = new WebSocket.Server({ server });

// In-memory data structure to store rooms
// Structure: { roomId: { clients: Set, content: string } }
const rooms = {};

// Handle WebSocket connections
// The 'connection' event fires whenever a new client connects.
// The `ws` object represents the individual connection to one client.
wss.on('connection', (ws) => {
  console.log('A new client connected!');

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    const { type, roomId, content } = data;

    if (!rooms[roomId]) {
      rooms[roomId] = {
        clients: new Set(),
        content: '',
      };
    }
    const room = rooms[roomId];

    switch (type) {
      case 'join':
        room.clients.add(ws);
        ws.roomId = roomId;
        console.log(`Client joined room: ${roomId}`);
        ws.send(JSON.stringify({ type: 'update', content: room.content }));
        break;

      case 'update':
        room.content = content;
        broadcast(roomId, ws, content);
        break;
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    const roomId = ws.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId].clients.delete(ws);
      if (rooms[roomId].clients.size === 0) {
        console.log(`Room ${roomId} is empty, deleting it.`);
        delete rooms[roomId];
      }
    }
  });
});

function broadcast(roomId, sender, content) {
  if (rooms[roomId]) {
    const message = JSON.stringify({ type: 'update', content });
    rooms[roomId].clients.forEach((client) => {
      if (client !== sender && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
