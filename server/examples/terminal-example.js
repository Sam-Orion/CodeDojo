const WebSocket = require('ws');

// Example: Connect to terminal service and run Python code
function connectTerminal() {
  const ws = new WebSocket('ws://localhost:3000');

  ws.on('open', () => {
    console.log('Connected to CodeDojo server');

    // Create a Python REPL session
    const createMessage = {
      type: 'TERMINAL_CREATE',
      clientId: 'example_client',
      userId: 'example_user',
      language: 'python',
      isRepl: true,
      mode: 'auto',
    };

    console.log('Sending:', JSON.stringify(createMessage, null, 2));
    ws.send(JSON.stringify(createMessage));
  });

  let sessionId = null;

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('Received:', JSON.stringify(message, null, 2));

    if (message.type === 'TERMINAL_CREATE') {
      sessionId = message.sessionId;
      console.log('\n✓ Session created:', sessionId);

      // Send Python code
      setTimeout(() => {
        const inputMessage = {
          type: 'TERMINAL_INPUT',
          sessionId,
          data: 'print("Hello from CodeDojo Terminal!")\n',
        };
        console.log('\nSending input:', inputMessage.data.trim());
        ws.send(JSON.stringify(inputMessage));
      }, 1000);

      // Send another command after 2 seconds
      setTimeout(() => {
        const inputMessage = {
          type: 'TERMINAL_INPUT',
          sessionId,
          data: 'import sys\nprint(f"Python version: {sys.version}")\n',
        };
        console.log('\nSending input:', inputMessage.data.trim());
        ws.send(JSON.stringify(inputMessage));
      }, 2000);

      // Close after 5 seconds
      setTimeout(() => {
        console.log('\nClosing connection...');
        ws.close();
      }, 5000);
    }

    if (message.type === 'TERMINAL_OUTPUT') {
      console.log('\n📤 Output:', message.data);
    }

    if (message.type === 'TERMINAL_EXIT') {
      console.log('\n✓ Terminal exited with code:', message.exitCode);
    }

    if (message.type === 'TERMINAL_ERROR') {
      console.error('\n✗ Error:', message.error);
      ws.close();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  ws.on('close', () => {
    console.log('\nConnection closed');
  });
}

// Run the example
console.log('CodeDojo Terminal Example');
console.log('=======================\n');
connectTerminal();
