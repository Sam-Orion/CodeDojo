// --- What's happening here? ---
// We are importing the necessary libraries that we installed earlier.
// 'express' helps us create the server.
// 'http' is a built-in Node.js module that Express uses under the hood.
// 'path' is another built-in module that helps us work with file and directory paths.

const express = require('express');
const http = require('http');
const path = require('path');

// --- What's happening here? ---
// We are creating our application and our server.
// 1. `app = express()` creates an instance of an Express application.
// 2. `server = http.createServer(app)` creates an HTTP server. We pass our `app` to it.

const app = express();
const server = http.createServer(app);

// --- What's happening here? ---
// This is a crucial line. It tells Express to serve static files (like HTML, CSS, and client-side JavaScript)
// from a directory named 'public'. Any file we put in the 'public' folder will be accessible from the browser.
// `__dirname` is a Node.js variable that gives the path of the current directory.

app.use(express.static(path.join(__dirname, 'public')));

// --- What's happening here? ---
// We are telling our server to start listening for connections.
// It will listen on port 3000. If that port is busy, it will use whatever is available.
// The `() => console.log(...)` part is a callback function that runs once the server is successfully started,
// printing a helpful message to our terminal.

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
