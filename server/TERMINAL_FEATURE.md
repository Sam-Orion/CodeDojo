# Terminal Orchestration Feature

## Quick Start

### Prerequisites

- Node.js 20+
- Docker installed and running (for local execution)
- Cloud provider credentials (optional, for cloud execution)

### Installation

Dependencies are already installed. If needed:

```bash
npm install -w server
```

### Basic Usage

#### 1. Via WebSocket

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  // Create a Python terminal session
  ws.send(
    JSON.stringify({
      type: 'TERMINAL_CREATE',
      clientId: 'my_client',
      language: 'python',
      isRepl: true,
      mode: 'auto',
    })
  );
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());

  if (message.type === 'TERMINAL_CREATE') {
    console.log('Session created:', message.sessionId);

    // Send input
    ws.send(
      JSON.stringify({
        type: 'TERMINAL_INPUT',
        sessionId: message.sessionId,
        data: 'print("Hello from CodeDojo!")\n',
      })
    );
  }

  if (message.type === 'TERMINAL_OUTPUT') {
    console.log('Output:', message.data);
  }

  if (message.type === 'TERMINAL_EXIT') {
    console.log('Session exited with code:', message.exitCode);
  }
});
```

#### 2. Via REST API

```bash
# Get supported languages
curl http://localhost:3000/api/v1/terminal/languages

# Get capabilities
curl http://localhost:3000/api/v1/terminal/capabilities

# Get sessions for a user
curl http://localhost:3000/api/v1/terminal/sessions?userId=user123

# Terminate a session
curl -X DELETE http://localhost:3000/api/v1/terminal/sessions/session_id
```

## Supported Languages

| Language   | File Extensions | REPL | Notes           |
| ---------- | --------------- | ---- | --------------- |
| JavaScript | .js, .mjs, .cjs | ✓    | Node.js 20      |
| TypeScript | .ts             | ✓    | Via ts-node     |
| Python     | .py             | ✓    | Python 3.11     |
| Java       | .java           | ✓    | JDK 17 + JShell |
| C          | .c              | ✗    | GCC             |
| C++        | .cpp, .cc, .cxx | ✗    | G++             |
| Go         | .go             | ✗    | Go 1.21         |
| Rust       | .rs             | ✗    | Rust 1.75       |
| Ruby       | .rb             | ✓    | Ruby 3.2 + IRB  |
| Bash       | .sh             | ✓    | Bash shell      |

## Execution Modes

### Local Mode

Executes code locally using Docker containers or PTY processes.

**Advantages:**

- No external dependencies
- Fast startup
- No additional cost

**Use Cases:**

- Development and testing
- Low to medium load
- Small deployments

**Configuration:**

```javascript
{
  type: 'TERMINAL_CREATE',
  language: 'python',
  mode: 'local',
  useContainer: true  // true for Docker, false for PTY
}
```

### Cloud Mode

Executes code on cloud providers (GCP, AWS, Azure).

**Advantages:**

- Unlimited scaling
- No local resource constraints
- Isolation from main server

**Use Cases:**

- Production deployments
- High load scenarios
- Untrusted code execution

**Configuration:**

```javascript
{
  type: 'TERMINAL_CREATE',
  language: 'python',
  mode: 'cloud',
  provider: 'auto'  // or 'gcp', 'aws', 'azure'
}
```

### Auto Mode (Recommended)

Automatically selects between local and cloud based on available resources.

**Configuration:**

```javascript
{
  type: 'TERMINAL_CREATE',
  language: 'python',
  mode: 'auto'
}
```

## Cloud Provider Setup

### Google Cloud Platform

1. Install gcloud CLI
2. Create project and enable Cloud Run API
3. Set environment variables:

```bash
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=us-central1
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

See `/docs/terminal.md` for detailed setup instructions.

### AWS

1. Create IAM user with Lambda/ECS permissions
2. Set environment variables:

```bash
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_REGION=us-east-1
export AWS_USE_LAMBDA=true
```

### Azure

1. Create service principal with Container Instance permissions
2. Set environment variables:

```bash
export AZURE_SUBSCRIPTION_ID=your-subscription-id
export AZURE_RESOURCE_GROUP=terminal-resources
export AZURE_LOCATION=eastus
```

## Security

### Command Sanitization

All input is automatically sanitized to prevent dangerous operations:

```javascript
// Blocked patterns:
'rm -rf /'; // Except /tmp, /home
'mkfs';
'dd if=';
':(){:|:&};:'; // Fork bomb
```

### Resource Limits

Each terminal session has the following limits:

- **Memory**: 512MB
- **CPU**: 1.0 cores
- **Timeout**: 5 minutes
- **Idle Timeout**: 30 minutes
- **Max Sessions**: 100 concurrent

### Network Isolation

Docker containers run with `NetworkMode: none` for complete network isolation.

## Examples

### Running a Python Script

```javascript
ws.send(
  JSON.stringify({
    type: 'TERMINAL_CREATE',
    clientId: 'client1',
    language: 'python',
    file: 'script.py',
    workspaceDir: '/path/to/workspace',
    mode: 'local',
  })
);
```

### Interactive Python REPL

```javascript
ws.send(
  JSON.stringify({
    type: 'TERMINAL_CREATE',
    clientId: 'client1',
    language: 'python',
    isRepl: true,
    mode: 'local',
  })
);
```

### Running with Environment Variables

```javascript
ws.send(
  JSON.stringify({
    type: 'TERMINAL_CREATE',
    clientId: 'client1',
    language: 'javascript',
    file: 'app.js',
    env: {
      NODE_ENV: 'production',
      API_KEY: 'secret',
    },
    mode: 'local',
  })
);
```

### Resizing Terminal

```javascript
ws.send(
  JSON.stringify({
    type: 'TERMINAL_RESIZE',
    sessionId: 'session_abc',
    cols: 120,
    rows: 40,
  })
);
```

## Testing

### Run Tests

```bash
# All terminal tests
npm test -w server -- tests/terminal.test.js

# Integration tests
npm test -w server -- tests/terminal-integration.test.js
```

### Manual Testing

1. Start the server:

```bash
npm run dev
```

2. Test via curl:

```bash
curl http://localhost:3000/api/v1/terminal/capabilities
```

3. Test via WebSocket (use the example above)

## Monitoring

### Metrics

Terminal metrics are exposed via Prometheus:

```bash
curl http://localhost:3000/api/v1/health/metrics
```

### Logs

All terminal operations are logged to:

- Console (via Winston logger)
- MongoDB (TerminalAuditLog collection)

View logs:

```javascript
const TerminalAuditLog = require('./src/models/TerminalAuditLog');
const logs = await TerminalAuditLog.find({ userId: 'user123' }).sort({ createdAt: -1 });
```

## Troubleshooting

### Docker Not Running

**Error**: `Cannot connect to Docker daemon`

**Solution**:

```bash
# Start Docker
sudo systemctl start docker

# Or for Docker Desktop
open -a Docker
```

### Image Pull Failed

**Error**: `Image not found: python:3.11-alpine`

**Solution**:

```bash
# Pre-pull required images
docker pull node:20-alpine
docker pull python:3.11-alpine
docker pull openjdk:17-alpine
docker pull golang:1.21-alpine
docker pull rust:1.75-alpine
docker pull ruby:3.2-alpine
docker pull gcc:latest
docker pull bash:latest
```

### Cloud Provider Authentication

**Error**: `GCP authentication failed`

**Solution**:

```bash
gcloud auth application-default login
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

### Session Limit Reached

**Error**: `Maximum number of sessions (100) reached`

**Solution**: Increase limit in `terminal-session.service.js` or clean up idle sessions:

```bash
curl -X DELETE http://localhost:3000/api/v1/terminal/sessions/OLD_SESSION_ID
```

## Performance Tips

1. **Use PTY for REPLs**: Set `useContainer: false` for faster REPL sessions
2. **Pre-pull Docker images**: Pull images during deployment to avoid cold starts
3. **Use cloud for production**: Cloud execution scales better for production workloads
4. **Monitor resource usage**: Check `/api/v1/terminal/stats` regularly

## Advanced Configuration

### Custom Docker Images

Modify `language-runtime.service.js` to use custom images:

```javascript
python: {
  extensions: ['.py'],
  dockerImage: 'my-registry/python-custom:latest',
  command: (file) => ['python3', file],
  // ...
}
```

### Adjust Resource Limits

Modify `local-executor.service.js`:

```javascript
this.resourceLimits = {
  memory: 1024 * 1024 * 1024, // 1GB
  cpus: 2.0,
  timeout: 600000, // 10 minutes
};
```

### Custom Cleanup Intervals

Modify `terminal-session.service.js`:

```javascript
this.maxIdleTimeout = 60 * 60 * 1000; // 1 hour
```

## Architecture

```
Terminal Orchestrator
  ├── Terminal Session Manager (lifecycle, metadata)
  ├── Terminal Scheduler (local vs cloud decision)
  │   ├── Local Executor
  │   │   ├── Docker Containers
  │   │   └── PTY Processes
  │   └── Cloud Executor
  │       ├── GCP Provider
  │       ├── AWS Provider
  │       └── Azure Provider
  ├── Language Runtime (8+ languages)
  └── Audit Logger (MongoDB)
```

## Related Documentation

- Full Documentation: `/docs/terminal.md`
- API Reference: `/docs/terminal.md#rest-api-endpoints`
- WebSocket Protocol: `/docs/terminal.md#websocket-protocol`
- Cloud Setup: `/docs/terminal.md#cloud-provider-setup`
