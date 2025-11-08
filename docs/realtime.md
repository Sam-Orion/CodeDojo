# Realtime Collaborative Editing Protocol

## Overview

CodeDojo implements a production-ready Operational Transformation (OT) engine supporting 50+ concurrent users with <100ms latency guarantees. This document describes the WebSocket message contracts, OT algorithm, and scaling considerations.

## Architecture

### Components

1. **WebSocket Service** (`server/src/services/websocket.service.js`)
   - Connection management
   - Message routing and validation
   - Event broadcasting

2. **Operational Transformation Service** (`server/src/services/ot.service.js`)
   - Document version tracking
   - Operation transformation and merging
   - Conflict resolution
   - Operation history management

3. **Room Manager Service** (`server/src/services/room-manager.service.js`)
   - In-memory room state (connections, presence, metadata)
   - Per-socket and per-room rate limiting
   - Backpressure management
   - Automatic cleanup of expired rooms

4. **Persistence Service** (`server/src/services/persistence.service.js`)
   - MongoDB integration for snapshots and operation history
   - Cursor state persistence
   - TTL-based automatic archival

5. **Message Validator** (`server/src/services/message-validator.service.js`)
   - Schema validation for all message types
   - Type checking and bounds validation

## WebSocket Message Protocol

### Message Types

#### 1. JOIN_ROOM

Join a collaboration room and receive the current document state.

**Request:**

```json
{
  "type": "JOIN_ROOM",
  "roomId": "string (required, max 100 chars)",
  "userId": "string (required, max 100 chars)",
  "clientId": "string (required, max 100 chars)",
  "documentId": "string (optional, MongoDB ObjectId)",
  "userInfo": "object (optional, client metadata)"
}
```

**Response: JOIN_ROOM_ACK**

```json
{
  "type": "JOIN_ROOM_ACK",
  "roomId": "string",
  "clientId": "string",
  "version": "number",
  "content": "string (current document content)",
  "participants": [
    {
      "userId": "string",
      "clientId": "string",
      "cursor": { "line": 0, "column": 0 },
      "joinedAt": "timestamp"
    }
  ]
}
```

**Broadcast to other participants: PARTICIPANT_JOINED**

```json
{
  "type": "PARTICIPANT_JOINED",
  "roomId": "string",
  "clientId": "string",
  "userId": "string",
  "participants": [{ "userId": "...", "clientId": "..." }],
  "userInfo": "object (optional)"
}
```

#### 2. LEAVE_ROOM

Leave a collaboration room.

**Request:**

```json
{
  "type": "LEAVE_ROOM",
  "roomId": "string (required)",
  "clientId": "string (required)"
}
```

**Response: LEAVE_ROOM_ACK**

```json
{
  "type": "LEAVE_ROOM_ACK",
  "roomId": "string",
  "clientId": "string"
}
```

**Broadcast to remaining participants: PARTICIPANT_LEFT**

```json
{
  "type": "PARTICIPANT_LEFT",
  "roomId": "string",
  "clientId": "string"
}
```

#### 3. OT_OP

Send an operational transformation operation (insert or delete).

**Request:**

```json
{
  "type": "OT_OP",
  "roomId": "string (required)",
  "clientId": "string (required)",
  "userId": "string (optional)",
  "operation": {
    "id": "string (unique operation ID)",
    "version": "number (document version at time of operation)",
    "type": "string (enum: 'insert', 'delete')",
    "position": "number (0-based position in document)",
    "content": "string (inserted/deleted text, max 10000 chars)"
  }
}
```

**Response: ACK (Acknowledgement)**

```json
{
  "type": "ACK",
  "roomId": "string",
  "clientId": "string",
  "operationId": "string",
  "version": "number (new document version after applying op)"
}
```

**Broadcast to other clients: OT_OP_BROADCAST**

```json
{
  "type": "OT_OP_BROADCAST",
  "roomId": "string",
  "operation": {
    "id": "string",
    "version": "number",
    "type": "string",
    "position": "number",
    "content": "string"
  },
  "version": "number",
  "senderClientId": "string"
}
```

**Backpressure Response: BACKPRESSURE**

```json
{
  "type": "BACKPRESSURE",
  "roomId": "string",
  "clientId": "string",
  "message": "Server is backpressured, please slow down"
}
```

#### 4. CURSOR_UPDATE

Update user cursor position (for presence awareness).

**Request:**

```json
{
  "type": "CURSOR_UPDATE",
  "roomId": "string (required)",
  "clientId": "string (required)",
  "userId": "string (optional)",
  "cursor": {
    "line": "number (0-based line number)",
    "column": "number (0-based column number)"
  }
}
```

**Broadcast to other clients: CURSOR_UPDATE_BROADCAST**

```json
{
  "type": "CURSOR_UPDATE_BROADCAST",
  "roomId": "string",
  "clientId": "string",
  "userId": "string",
  "cursor": {
    "line": "number",
    "column": "number"
  }
}
```

#### 5. SYNC_STATE

Request full document state and missing operations (for late joins or reconnects).

**Request:**

```json
{
  "type": "SYNC_STATE",
  "roomId": "string (required)",
  "clientId": "string (required)",
  "fromVersion": "number (optional, default 0)"
}
```

**Response: SYNC_STATE_RESPONSE**

```json
{
  "type": "SYNC_STATE_RESPONSE",
  "roomId": "string",
  "clientId": "string",
  "snapshot": {
    "version": "number",
    "content": "string"
  },
  "operations": [
    {
      "id": "string",
      "version": "number",
      "type": "string",
      "position": "number",
      "content": "string"
    }
  ],
  "cursorStates": [
    {
      "userId": "string",
      "clientId": "string",
      "cursor": { "line": "number", "column": "number" }
    }
  ],
  "participants": [
    {
      "userId": "string",
      "clientId": "string",
      "cursor": { "line": "number", "column": "number" }
    }
  ]
}
```

#### 6. ACK (Acknowledgement)

Acknowledge receipt and application of an operation.

**Request:**

```json
{
  "type": "ACK",
  "roomId": "string (required)",
  "clientId": "string (required)",
  "operationId": "string (required)"
}
```

#### 7. ERROR

Error response from server.

**Server Response:**

```json
{
  "type": "ERROR",
  "code": "string (error code)",
  "message": "string (human-readable error message)",
  "roomId": "string (optional)",
  "clientId": "string (optional)",
  "timestamp": "number (epoch milliseconds)"
}
```

## Operational Transformation Algorithm

### Overview

The OT algorithm maintains eventual consistency across all clients in a room by:

1. **Versioning**: Each operation is associated with a document version
2. **Transformation**: When concurrent operations occur, they are transformed against each other
3. **Merging**: Transformed operations are applied to create a merged result
4. **Broadcasting**: The final operation is broadcast to all other clients

### Algorithm Details

#### Operation Application

1. Client A sends operation `opA` at version V
2. Server receives `opA` and transforms it against any pending operations from other clients
3. Server applies the transformed operation to the document
4. Server increments version: V → V+1
5. Server sends ACK to client A with new version
6. Server broadcasts the transformed operation to other clients

#### Transformation Rules

When two concurrent operations `op1` and `op2` both occur at version V:

**Case 1: Different positions**

- If `op1.position < op2.position`:
  - Insert/Delete by `op1` may shift `op2`'s position
  - Adjust `op2.position` based on `op1`'s effect

**Case 2: Same position**

- Use deterministic tiebreaker: compare `clientId`s
- Client with lexicographically smaller ID has priority
- Other client's operation position is adjusted

**Example:**

```
Initial:    ""
op1: insert "A" at 0  (from client_1)
op2: insert "B" at 0  (from client_2)

If client_1 < client_2:
  op1 applied: "A"
  op2 transformed to: insert "B" at 1
  Result: "AB"

If client_2 < client_1:
  op2 applied: "B"
  op1 transformed to: insert "A" at 1
  Result: "BA"
```

#### Conflict Resolution

- No manual conflict resolution needed - OT handles all conflicts automatically
- Deterministic clientId comparison ensures all clients reach identical state
- No user intervention required

### Operation History

- All operations are stored in MongoDB with TTL (default 30 days)
- Snapshots are periodically saved (on demand after large operation batches)
- Late-joining clients replay operations since their last known version

## Room Lifecycle

### Room Creation

- Implicit when first client joins
- Room metadata includes max participants (default 50)
- Automatic cleanup after TTL (default 30 minutes with no activity)

### Room Cleanup

- Runs every 60 seconds
- Deletes empty rooms that have exceeded TTL
- Preserves room snapshots and operation history

### Participant Tracking

- Maintains in-memory presence map (clientId → UserPresence)
- Tracks cursor position for UI awareness
- Broadcasts presence updates in real-time

## Rate Limiting & Backpressure

### Per-Socket Rate Limiting

**Configuration:**

```javascript
{
  windowMs: 1000,        // 1-second window
  maxOpsPerWindow: 50,   // Max 50 operations per second
  backpressureThreshold: 100  // Room-wide queue threshold
}
```

### Backpressure Mechanism

1. Client sends operation
2. Server checks local rate limit (50 ops/sec per socket)
3. Server checks room-wide queue depth (threshold: 100 pending ops)
4. If exceeded, server sends BACKPRESSURE signal
5. Client should slow down or queue locally
6. Normal processing resumes when queue drains

### Metrics

- `ot_operation_latency_ms`: Histogram of operation processing time
- `ot_operations_total`: Counter of operations by type and status
- `ot_queue_depth`: Gauge of current operation queue depth
- `ot_conflicts_resolved_total`: Counter of conflict resolutions

## Persistence

### Snapshot Strategy

- Snapshots saved on-demand (after large operation bursts)
- Stored in MongoDB with TTL (default 60 days)
- Includes content, version, and metadata (modification time, modifier)

### Operation History

- Every operation persisted to MongoDB immediately
- Indexed by (roomId, version) for efficient replay
- TTL 30 days for automatic cleanup
- Supports incremental sync for late joiners

### Cursor State

- Last cursor position per user persisted
- TTL 7 days for automatic cleanup
- Used during late join to restore presence

## Late Join & Reconnection

### Late Join Flow

1. New client joins with `JOIN_ROOM`
2. Server sends current snapshot (version N, content)
3. If client had previous version M < N:
   - Send operations from version M+1 to N
   - Client replays operations to rebuild state
4. Client can now proceed normally

### Reconnection Flow

1. Client reconnects and sends `SYNC_STATE` with `fromVersion`
2. Server sends:
   - Current snapshot
   - All operations since `fromVersion`
   - Current participant list and cursor states
3. Client replays operations and resynchronizes

## Scaling Considerations

### Horizontal Scaling

**Current: Single-Process**

- In-memory room manager works for single server
- All connections served by one process

**For Distributed Systems:**

1. **Redis/Memcached for Room State:**
   - Extend room manager to use Redis for shared state
   - Implement room presence as Redis sets

2. **Message Queue (RabbitMQ/Kafka):**
   - Broadcast operations via message queue
   - Each server subscribes to queue for its rooms

3. **MongoDB for State:**
   - Current snapshots and history already in MongoDB
   - Add room metadata to MongoDB for visibility

### Load Testing

Latency targets under 50 concurrent users:

- Operation ACK: <50ms
- Operation broadcast: <100ms
- Cursor update: <50ms

Monitored metrics:

- `ot_operation_latency_ms` histogram
- `ot_queue_depth` gauge
- Operation success rate

## Error Handling

### Validation Errors

- Message schema validation on all incoming messages
- Invalid operations rejected with ERROR response
- Client can retry with corrected message

### Transformation Errors

- Rare, but possible with malformed operations
- Operation discarded, error sent to client
- Other clients unaffected

### Persistence Failures

- Operation applied immediately in memory
- Persistence failures logged but non-blocking
- TTL ensures eventual consistency even if some writes fail

### Connection Loss

- Client automatically exits on disconnect
- Other clients notified with PARTICIPANT_LEFT
- Buffered operations discarded (client resync on reconnect)

## Client Implementation Guide

### Basic Flow

1. **Connect and Join:**

   ```javascript
   ws.send(
     JSON.stringify({
       type: 'JOIN_ROOM',
       roomId: 'doc-123',
       userId: 'user-456',
       clientId: 'client-789',
     })
   );
   ```

2. **Wait for JOIN_ROOM_ACK:**

   ```javascript
   ws.on('message', (data) => {
     const msg = JSON.parse(data);
     if (msg.type === 'JOIN_ROOM_ACK') {
       // Initialize editor with msg.content
       editorContent = msg.content;
       currentVersion = msg.version;
     }
   });
   ```

3. **Send Operations:**

   ```javascript
   ws.send(
     JSON.stringify({
       type: 'OT_OP',
       roomId: 'doc-123',
       clientId: 'client-789',
       operation: {
         id: `op_${Date.now()}`,
         version: currentVersion,
         type: 'insert',
         position: 10,
         content: 'Hello',
       },
     })
   );
   ```

4. **Handle ACKs:**

   ```javascript
   if (msg.type === 'ACK') {
     // Remove from pending queue
     pendingOps = pendingOps.filter((op) => op.id !== msg.operationId);
     currentVersion = msg.version;
   }
   ```

5. **Apply Remote Operations:**
   ```javascript
   if (msg.type === 'OT_OP_BROADCAST') {
     // Transform local pending ops against remote op
     // Apply remote op
     applyOperationLocally(msg.operation);
     currentVersion = msg.version;
   }
   ```

### Conflict Resolution for Clients

- No client-side conflict resolution needed
- Server handles all conflicts via OT
- Client sees final consistent state

### Handling Backpressure

```javascript
if (msg.type === 'BACKPRESSURE') {
  // Queue operations locally
  // Reduce sending rate
  // Resume when BACKPRESSURE clears
}
```

## Monitoring & Observability

### Prometheus Metrics

```
ot_operation_latency_ms{quantile="0.5"}  < 50ms (median)
ot_operation_latency_ms{quantile="0.95"} < 100ms (95th percentile)
ot_operations_total{type="insert", status="applied"}
ot_queue_depth
```

### Logging

- All joins/leaves logged at INFO level
- All operations logged at DEBUG level
- Errors logged at ERROR level with correlation ID

## Future Enhancements

1. **Rich Text Support:** Extend OT for formatted text
2. **Comments & Annotations:** Layer metadata operations
3. **Selective Sync:** Only sync needed regions for large documents
4. **Automatic Snapshots:** Trigger based on operation count
5. **Compression:** Compress operation history for archival
6. **Conflict Resolution UI:** Show user conflicts if needed

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**Maintainer:** CodeDojo Team
