const express = require('express');
const http = require('http');
const path = require('path');
// --- NEW: Import the WebSocket library ---
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, 'public')));

// --- NEW: Create a WebSocket server and attach it to our existing HTTP server ---
// This allows both the web page and the WebSocket to be served on the same port.
const wss = new WebSocket.Server({ server });

// --- NEW: A simple in-memory data structure to store our rooms ---
// The structure will look like this:
// {
//   "roomId1": {
//     clients: [ws1, ws2],
//     content: "some code..."
//   },
//   "roomId2": { ... }
// }
const rooms = {};

// --- NEW: This is the core of our real-time logic ---
// The 'connection' event fires whenever a new client connects.
// The `ws` object represents the individual connection to one client.
wss.on('connection', (ws) => {
    console.log('A new client connected!');

    // The 'message' event fires when the server receives data from this client.
    ws.on('message', (message) => {
        // We expect the message to be a JSON string, so we parse it.
        const data = JSON.parse(message);
        const { type, roomId, content } = data;

        // Ensure the room exists
        if (!rooms[roomId]) {
            rooms[roomId] = {
                clients: new Set(), // Using a Set automatically handles duplicates
                content: ''
            };
        }
        const room = rooms[roomId];

        // We use a `switch` statement to handle different message types from the client.
        switch (type) {
            case 'join':
                // When a user joins a room:
                room.clients.add(ws); // Add them to the list of clients in that room.
                ws.roomId = roomId;   // Store the roomId on the WebSocket object for later reference.
                console.log(`Client joined room: ${roomId}`);
                // Send the current content of the room to the newly joined client.
                ws.send(JSON.stringify({ type: 'update', content: room.content }));
                break;

            case 'update':
                // When a user sends a code update:
                room.content = content; // Update the room's content on the server.
                // Broadcast the new content to all *other* clients in the same room.
                broadcast(roomId, ws, content);
                break;
        }
    });

    // The 'close' event fires when a client disconnects.
    ws.on('close', () => {
        console.log('Client disconnected');
        // If the client was in a room, we need to remove them.
        const roomId = ws.roomId;
        if (roomId && rooms[roomId]) {
            rooms[roomId].clients.delete(ws);
            // Optional: If the room is now empty, you could delete it.
            if (rooms[roomId].clients.size === 0) {
                console.log(`Room ${roomId} is empty, deleting it.`);
                delete rooms[roomId];
            }
        }
    });
});

// --- NEW: A helper function to broadcast messages ---
function broadcast(roomId, sender, content) {
    if (rooms[roomId]) {
        // Create the message payload once.
        const message = JSON.stringify({ type: 'update', content });
        // Iterate over all clients in the room.
        rooms[roomId].clients.forEach(client => {
            // Check if the client is not the original sender and is ready to receive messages.
            if (client !== sender && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));