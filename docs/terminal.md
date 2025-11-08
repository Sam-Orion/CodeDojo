# Terminal Orchestration

## Overview

The Terminal Orchestration system provides dual-mode terminal functionality supporting 8+ programming languages with both local and cloud execution capabilities. The system includes WebSocket streaming for real-time terminal I/O and supports multiple cloud providers (GCP, AWS, Azure).

## Architecture

### Components

1. **Terminal Orchestrator Service**: Main service coordinating terminal session lifecycle
2. **Terminal Session Service**: Manages individual terminal sessions and their metadata
3. **Terminal Scheduler Service**: Decides between local and cloud execution based on load and configuration
4. **Local Executor Service**: Handles local execution via Docker containers or PTY processes
5. **Cloud Executor Service**: Abstracts cloud provider integrations
6. **Language Runtime Service**: Manages language-specific configurations and command templates

### Execution Modes

- **Local Mode**: Executes code in Docker containers or PTY processes on the server
- **Cloud Mode**: Executes code on cloud providers (GCP Cloud Run, AWS Lambda/Fargate, Azure Container Instances)
- **Auto Mode**: Automatically selects between local and cloud based on resource availability

## Supported Languages

The system supports 8+ programming languages out of the box:

| Language   | Extensions      | Docker Image       | REPL Support |
| ---------- | --------------- | ------------------ | ------------ |
| JavaScript | .js, .mjs, .cjs | node:20-alpine     | ✓            |
| TypeScript | .ts             | node:20-alpine     | ✓            |
| Python     | .py             | python:3.11-alpine | ✓            |
| Java       | .java           | openjdk:17-alpine  | ✓            |
| C          | .c              | gcc:latest         | ✗            |
| C++        | .cpp, .cc, .cxx | gcc:latest         | ✗            |
| Go         | .go             | golang:1.21-alpine | ✗            |
| Rust       | .rs             | rust:1.75-alpine   | ✗            |
| Ruby       | .rb             | ruby:3.2-alpine    | ✓            |
| Bash       | .sh             | bash:latest        | ✓            |

## WebSocket Protocol

### Message Types

#### TERMINAL_CREATE

Create a new terminal session.

**Request:**

```json
{
  "type": "TERMINAL_CREATE",
  "clientId": "client_123",
  "userId": "user_456",
  "roomId": "room_789",
  "language": "python",
  "file": "script.py",
  "workspaceDir": "/path/to/workspace",
  "isRepl": false,
  "mode": "auto",
  "useContainer": true,
  "env": {
    "ENV_VAR": "value"
  },
  "metadata": {}
}
```

**Response:**

```json
{
  "type": "TERMINAL_CREATE",
  "sessionId": "session_abc",
  "mode": "local",
  "status": "running",
  "language": "python"
}
```

#### TERMINAL_INPUT

Send input to a terminal session.

**Request:**

```json
{
  "type": "TERMINAL_INPUT",
  "sessionId": "session_abc",
  "data": "print('hello')\n"
}
```

#### TERMINAL_RESIZE

Resize the terminal.

**Request:**

```json
{
  "type": "TERMINAL_RESIZE",
  "sessionId": "session_abc",
  "cols": 80,
  "rows": 30
}
```

#### TERMINAL_OUTPUT

Receive output from terminal (server to client).

**Message:**

```json
{
  "type": "TERMINAL_OUTPUT",
  "sessionId": "session_abc",
  "data": "hello\n"
}
```

#### TERMINAL_EXIT

Terminal session has exited (server to client).

**Message:**

```json
{
  "type": "TERMINAL_EXIT",
  "sessionId": "session_abc",
  "exitCode": 0,
  "signal": null
}
```

#### TERMINAL_ERROR

Error occurred in terminal session (server to client).

**Message:**

```json
{
  "type": "TERMINAL_ERROR",
  "sessionId": "session_abc",
  "error": "Error message",
  "code": "TERMINAL_CREATE_ERROR"
}
```

### Error Codes

- `TERMINAL_CREATE_ERROR`: Failed to create terminal session
- `TERMINAL_INPUT_ERROR`: Failed to send input to terminal
- `TERMINAL_RESIZE_ERROR`: Failed to resize terminal
- `VALIDATION_ERROR`: Message validation failed

## REST API Endpoints

### GET /api/v1/terminal/capabilities

Get terminal capabilities and supported features.

**Response:**

```json
{
  "success": true,
  "data": {
    "languages": [...],
    "executionModes": {
      "local": { "available": true, ... },
      "cloud": { "available": true, "providers": ["gcp", "aws", "azure"] }
    },
    "resourceLimits": { ... },
    "strategy": { ... }
  }
}
```

### GET /api/v1/terminal/languages

Get supported languages and their details.

**Response:**

```json
{
  "success": true,
  "data": {
    "languages": ["javascript", "python", ...],
    "details": [
      {
        "language": "python",
        "extensions": [".py"],
        "hasRepl": true,
        "dockerImage": "python:3.11-alpine"
      }
    ]
  }
}
```

### GET /api/v1/terminal/stats

Get terminal system statistics.

**Response:**

```json
{
  "success": true,
  "data": {
    "sessions": {
      "total": 5,
      "byMode": { "local": 3, "cloud": 2 },
      "byLanguage": { "python": 2, "javascript": 3 }
    }
  }
}
```

### GET /api/v1/terminal/sessions?userId=xxx

Get sessions for a specific user or room.

**Query Parameters:**

- `userId`: Filter by user ID
- `roomId`: Filter by room ID

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "session_abc",
      "userId": "user_123",
      "language": "python",
      "mode": "local",
      "status": "running",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET /api/v1/terminal/sessions/:sessionId

Get details of a specific terminal session.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "session_abc",
    "userId": "user_123",
    "language": "python",
    "mode": "local",
    "status": "running",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### DELETE /api/v1/terminal/sessions/:sessionId

Terminate a terminal session.

**Response:**

```json
{
  "success": true,
  "message": "Session terminated"
}
```

## Cloud Provider Setup

### Google Cloud Platform (GCP)

#### Requirements

- GCP project with Cloud Run API enabled
- Service account with `run.jobs.create` permission
- GOOGLE_APPLICATION_CREDENTIALS environment variable or default credentials

#### Environment Variables

```bash
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
```

#### IAM Roles Required

- `roles/run.developer` - Create and manage Cloud Run jobs
- `roles/iam.serviceAccountUser` - Use service accounts

#### Setup Steps

1. Enable Cloud Run API:

   ```bash
   gcloud services enable run.googleapis.com
   ```

2. Create service account:

   ```bash
   gcloud iam service-accounts create terminal-executor \
     --display-name="Terminal Executor"
   ```

3. Grant permissions:

   ```bash
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:terminal-executor@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/run.developer"
   ```

4. Download credentials:

   ```bash
   gcloud iam service-accounts keys create credentials.json \
     --iam-account=terminal-executor@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```

5. Set environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"
   ```

### Amazon Web Services (AWS)

#### Requirements

- AWS account with Lambda or ECS/Fargate access
- IAM user with appropriate permissions
- AWS credentials configured

#### Environment Variables

```bash
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_USE_LAMBDA=true  # Use Lambda, or false for ECS Fargate
```

#### IAM Roles Required

For Lambda:

- `lambda:InvokeFunction` - Invoke Lambda functions
- `lambda:CreateFunction` - Create Lambda functions (if needed)

For ECS Fargate:

- `ecs:RunTask` - Run ECS tasks
- `ecs:DescribeTasks` - Get task status
- `iam:PassRole` - Pass execution role to tasks

#### Setup Steps for Lambda

1. Create execution role:

   ```bash
   aws iam create-role --role-name terminal-executor-lambda \
     --assume-role-policy-document file://trust-policy.json
   ```

2. Attach basic execution policy:

   ```bash
   aws iam attach-role-policy --role-name terminal-executor-lambda \
     --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
   ```

3. Create Lambda functions for each language runtime

#### Setup Steps for ECS Fargate

1. Create ECS cluster:

   ```bash
   aws ecs create-cluster --cluster-name terminal-cluster
   ```

2. Register task definition:

   ```bash
   aws ecs register-task-definition --cli-input-json file://task-definition.json
   ```

3. Configure VPC and security groups for internet access

### Microsoft Azure

#### Requirements

- Azure subscription
- Azure CLI installed
- Service principal with Container Instance permissions

#### Environment Variables

```bash
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=terminal-resources
AZURE_LOCATION=eastus
```

#### IAM Roles Required

- `Contributor` role on resource group or subscription
- `Container Instances Contributor` - Manage container instances

#### Setup Steps

1. Login to Azure:

   ```bash
   az login
   ```

2. Create resource group:

   ```bash
   az group create --name terminal-resources --location eastus
   ```

3. Create service principal:

   ```bash
   az ad sp create-for-rbac --name terminal-executor \
     --role Contributor \
     --scopes /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/terminal-resources
   ```

4. Set environment variables from service principal output:
   ```bash
   export AZURE_CLIENT_ID=<appId>
   export AZURE_CLIENT_SECRET=<password>
   export AZURE_TENANT_ID=<tenant>
   export AZURE_SUBSCRIPTION_ID=<subscription-id>
   ```

## Security Controls

### Command Sanitization

The system sanitizes all terminal input to prevent dangerous operations:

- Maximum input length: 10,000 characters
- Blocked patterns:
  - `rm -rf /` (except /tmp, /home)
  - `mkfs` commands
  - `dd if=` commands
  - Fork bombs

### Resource Limits

#### Local Execution

- Memory: 512MB per container
- CPU: 1.0 cores per container
- Timeout: 5 minutes per session
- Max concurrent containers: 20
- Max concurrent PTY processes: 50

#### Session Limits

- Max idle timeout: 30 minutes
- Max total sessions: 100

### Network Isolation

Docker containers run with `NetworkMode: none` for security isolation.

### Audit Logging

All terminal operations are logged with:

- Session ID
- User ID
- Command/input
- Timestamp
- Execution mode
- Exit code/status

## Extending Language Support

To add a new language:

1. Add language configuration in `language-runtime.service.js`:

```javascript
newlanguage: {
  extensions: ['.ext'],
  dockerImage: 'image:tag',
  command: (file) => ['interpreter', file],
  replCommand: ['interpreter'],
  version: 'interpreter --version',
  setup: ['optional', 'setup', 'commands'],
}
```

2. Ensure Docker image is available or create custom image

3. Test with integration tests

4. Update documentation

## Testing

### Running Tests

```bash
# All tests
npm run test -w server

# Specific test file
npm run test -w server -- tests/terminal.test.js
```

### Manual Testing

1. Start server:

   ```bash
   npm run dev
   ```

2. Connect via WebSocket:

   ```javascript
   const ws = new WebSocket('ws://localhost:3000');

   ws.onopen = () => {
     ws.send(
       JSON.stringify({
         type: 'TERMINAL_CREATE',
         clientId: 'test_client',
         language: 'python',
         isRepl: true,
         mode: 'local',
       })
     );
   };

   ws.onmessage = (event) => {
     const data = JSON.parse(event.data);
     console.log('Received:', data);
   };
   ```

3. Test via REST API:
   ```bash
   curl http://localhost:3000/api/v1/terminal/capabilities
   ```

## Troubleshooting

### Docker Issues

**Problem**: Docker images not found

```
Solution: Pull required images manually:
docker pull node:20-alpine
docker pull python:3.11-alpine
```

**Problem**: Permission denied accessing Docker socket

```
Solution: Add user to docker group:
sudo usermod -aG docker $USER
```

### Cloud Provider Issues

**Problem**: GCP authentication failed

```
Solution: Verify GOOGLE_APPLICATION_CREDENTIALS is set and file exists
echo $GOOGLE_APPLICATION_CREDENTIALS
gcloud auth application-default login
```

**Problem**: AWS credentials not found

```
Solution: Configure AWS credentials:
aws configure
# Or set environment variables
```

**Problem**: Azure authentication failed

```
Solution: Login to Azure CLI:
az login
az account set --subscription YOUR_SUBSCRIPTION_ID
```

### Session Issues

**Problem**: Session timeout too short

```
Solution: Adjust timeout in terminal-session.service.js:
this.maxIdleTimeout = 60 * 60 * 1000; // 1 hour
```

**Problem**: Too many sessions error

```
Solution: Increase session limit in terminal-session.service.js:
this.maxSessions = 200;
```

## Performance Considerations

### Local Execution

- Use PTY mode for shell/REPL sessions (faster than containers)
- Use container mode for file execution (better isolation)
- Docker image pull can take time on first use - consider pre-pulling

### Cloud Execution

- AWS Lambda: Best for short-running, stateless executions
- AWS Fargate: Better for long-running processes
- GCP Cloud Run: Good balance of cold-start and execution time
- Azure Container Instances: Flexible but slower cold-start

### Scaling

The system can handle:

- 50+ concurrent sessions in local mode
- Unlimited sessions in cloud mode (subject to cloud provider quotas)
- <100ms operation latency for terminal I/O

## Cost Considerations

### Local Execution

- No additional cost
- Resource consumption on server
- Suitable for development/small deployments

### Cloud Execution

- GCP Cloud Run: ~$0.000024 per second
- AWS Lambda: ~$0.0000166667 per GB-second
- AWS Fargate: ~$0.04048 per vCPU-hour + $0.004445 per GB-hour
- Azure Container Instances: ~$0.0000012 per vCPU-second + $0.00000014 per GB-second

Estimate: 100 terminal sessions/month, 5 min avg duration = ~$5-20/month depending on provider
