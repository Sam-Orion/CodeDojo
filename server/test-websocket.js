const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  console.log('✅ WebSocket connection established');

  setTimeout(() => {
    console.log('📤 Joining room "test-room"');
    ws.send(
      JSON.stringify({
        type: 'collaboration:join',
        roomId: 'test-room',
      })
    );
  }, 100);

  setTimeout(() => {
    console.log('📤 Sending update');
    ws.send(
      JSON.stringify({
        type: 'collaboration:update',
        roomId: 'test-room',
        content: 'console.log("Hello from WebSocket test!");',
      })
    );
  }, 500);

  setTimeout(() => {
    console.log('📤 Sending ping');
    ws.send(JSON.stringify({ type: 'ping' }));
  }, 1000);

  setTimeout(() => {
    console.log('✅ Test completed, closing connection');
    ws.close();
  }, 1500);
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('📥 Received:', message);
});

ws.on('close', () => {
  console.log('🔌 WebSocket connection closed');
  process.exit(0);
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
  process.exit(1);
});
