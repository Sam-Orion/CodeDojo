# Editor Collaboration UI Implementation

This document describes the implementation of the Monaco-based collaborative editor frontend with real-time collaboration features, operational transformation, presence indicators, and resilience handling.

## Overview

The collaborative editor provides a complete real-time editing experience with multiple concurrent users working on the same document. It includes:

- **Monaco Editor Integration**: Syntax highlighting, language modes, theming
- **Real-time Synchronization**: WebSocket-based OT (Operational Transformation) protocol
- **Multi-cursor Support**: Distinct colors per participant with real-time cursor tracking
- **Presence Awareness**: Participant list with activity status and cursor positions
- **Connection Resilience**: Automatic reconnection, offline queuing, heartbeat monitoring
- **Edit History**: Undo/redo stacks with conflict resolution

## Architecture

### Components

#### MonacoEditorWrapper

Main editor component wrapping Monaco Editor with:

- Language selection and syntax highlighting
- Theme toggling (Light/Dark/High Contrast)
- Change detection and operation generation
- Cursor position tracking for presence indicators

**Location**: `src/components/MonacoEditorWrapper.tsx`

```typescript
<MonacoEditorWrapper
  language="javascript"
  theme="vs-dark"
  onOperationChange={(operation) => {...}}
  onCursorChange={(cursor) => {...}}
/>
```

#### ParticipantsList

Displays all participants in the room with:

- Participant avatars (color-coded)
- Real-time cursor positions
- Active/inactive status indicators

**Location**: `src/components/ParticipantsList.tsx`

#### ConnectionStatus

Shows current WebSocket connection status:

- Idle, Connecting, Connected, Disconnected, Error states
- Animated connecting state with dots
- Color-coded status indicators

**Location**: `src/components/ConnectionStatus.tsx`

#### EditorControls

UI controls for editor configuration:

- Language selector (JavaScript, TypeScript, Python, Java, C#, C++, HTML, CSS, JSON, SQL)
- Theme selector (Light, Dark, High Contrast)
- Undo/Redo buttons
- Save button

**Location**: `src/components/EditorControls.tsx`

### Services

#### EditorWebSocketController

Manages WebSocket communication for editor operations:

- Joins/leaves rooms
- Sends/receives OT operations
- Broadcasts cursor updates
- Handles participant joins/leaves
- Implements heartbeat/ping mechanism

**Location**: `src/services/editorWebSocketController.ts`

**Key Methods**:

- `connect(userInfo)`: Establishes connection and joins room
- `sendOperation(operation)`: Broadcasts edit operation
- `sendCursorUpdate(cursor)`: Sends cursor position
- `leaveRoom()`: Gracefully disconnects
- `isConnected()`: Returns connection status

#### OTClient

Client-side Operational Transformation implementation:

- Transforms local operations against remote ones
- Maintains operation history and revision tracking
- Supports insert/delete operations
- Provides undo/inverse operations

**Location**: `src/services/otClient.ts`

**Key Methods**:

- `applyOperation(operation)`: Applies local operation
- `applyServerOperation(operation)`: Applies remote operation with transformation
- `transformAgainstOperation(op1, op2)`: OT algorithm implementation
- `applyContent(content, operation)`: Applies operation to document text
- `inverse(operation, content)`: Creates undo operation

### Redux State Management

#### CollaborationSlice

Manages all collaboration-related state:

```typescript
interface CollaborationState {
  currentRoom: Room | null;
  participants: ParticipantPresence[];
  isConnected: boolean;
  operationQueue: Operation[];
  documentContent: string;
  documentVersion: number;
  operationHistory: Operation[];
  pendingOperations: Operation[];
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  lastSyncTime: number | null;
  undoStack: Operation[];
  redoStack: Operation[];
}
```

**Reducers**:

- `setConnectionStatus`: Updates connection state
- `addOperation/removePendingOperation`: Manages operation queue
- `setDocumentContent`: Updates document text
- `updateParticipant/removeParticipant`: Manages participants
- `updateCursor/updateSelection`: Tracks presence
- `pushUndoOperation/pushRedoOperation`: Manages undo/redo

**Location**: `src/store/slices/collaborationSlice.ts`

## WebSocket Protocol

### Message Types

#### JOIN_ROOM

Client sends when joining a room:

```json
{
  "type": "JOIN_ROOM",
  "payload": {
    "roomId": "room123",
    "clientId": "client456",
    "userId": "user789",
    "userInfo": { "username": "Alice" }
  }
}
```

Server responds with:

```json
{
  "type": "JOIN_ROOM_ACK",
  "roomId": "room123",
  "clientId": "client456",
  "version": 42,
  "content": "current document content",
  "participants": [...]
}
```

#### OT_OP

Client sends operations:

```json
{
  "type": "OT_OP",
  "payload": {
    "roomId": "room123",
    "clientId": "client456",
    "userId": "user789",
    "operation": {
      "id": "op123",
      "type": "insert",
      "position": 10,
      "content": "hello",
      "clientId": "client456",
      "version": 42
    }
  }
}
```

Server broadcasts:

```json
{
  "type": "OT_OP_BROADCAST",
  "roomId": "room123",
  "operation": {...},
  "version": 43,
  "senderClientId": "client456"
}
```

#### CURSOR_UPDATE

Client sends cursor position:

```json
{
  "type": "CURSOR_UPDATE",
  "payload": {
    "roomId": "room123",
    "clientId": "client456",
    "cursor": { "line": 5, "column": 10 }
  }
}
```

#### PARTICIPANT_JOINED / PARTICIPANT_LEFT

Server broadcasts when participants join/leave:

```json
{
  "type": "PARTICIPANT_JOINED",
  "roomId": "room123",
  "clientId": "client456",
  "userId": "user789",
  "participants": [...],
  "userInfo": { "username": "Alice" }
}
```

## Operational Transformation Algorithm

The implementation uses a simplified OT algorithm for conflict resolution:

### Position Adjustment Logic

When transforming operations:

1. **Same Position**: Use client ID as tiebreaker
2. **op1 After op2**: Adjust op1 position based on op2's content length
3. **op1 Before op2**: No adjustment needed

### Example

```typescript
Local Op: Insert "hello" at position 5
Remote Op: Insert "world" at position 3

Transformed: Insert "hello" at position 5 + 5 = 10
```

## Multi-Cursor Rendering

Each participant gets a unique color from the palette:

```typescript
const PARTICIPANT_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#FFA07A',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#85C1E2',
  '#F8B88B',
  '#52C4A1',
];
```

Cursors are rendered as Monaco editor decorations with:

- Colored border matching participant color
- Username tooltip on hover
- Real-time position updates

## Connection Resilience

### Heartbeat

- Ping sent every 30 seconds when connected
- Detects stale connections
- Triggers reconnection on timeout

### Offline Support

- Operations queued when disconnected
- Queued ops sent when reconnected
- Conflict resolution handled by OT transformation

### Auto-reconnection

- Exponential backoff: 3000ms \* 2^(attempt-1)
- Max 5 reconnection attempts
- Syncs document state after reconnect

## Undo/Redo

### Implementation

- Undo stack stores all applied operations
- Redo stack stores undone operations
- Each undo operation creates inverse of original operation
- Clear redo stack on new edits

### Inverse Operations

```typescript
Insert "hello" at pos 5
  ↓
Delete "hello" at pos 5 (inverse)

Delete "world" at pos 10
  ↓
Insert "world" at pos 10 (inverse)
```

## Testing

### Unit Tests

#### OTClient Tests (`src/services/otClient.test.ts`)

- Operation application and versioning
- Content transformation
- Operation inversion
- Pending/server operations tracking

#### CollaborationSlice Tests (`src/store/slices/collaborationSlice.test.ts`)

- Connection state management
- Operation queue handling
- Document state updates
- Participant presence tracking
- Undo/redo stacks

#### Component Tests (`src/components/MonacoEditorWrapper.test.tsx`)

- Editor rendering with various configurations
- Language/theme switching
- Callback invocations

### Integration Testing

The implementation handles multi-client scenarios:

1. Two clients join the same room
2. Client A edits, operation broadcasts to Client B
3. Client B edits simultaneously, operation sent to Client A
4. OT transforms both operations, document converges

## Usage Example

```typescript
// In WorkspacePage component
import MonacoEditorWrapper from '@/components/MonacoEditorWrapper';
import EditorControls from '@/components/EditorControls';
import ParticipantsList from '@/components/ParticipantsList';
import ConnectionStatus from '@/components/ConnectionStatus';

const WorkspacePage = () => {
  const [language, setLanguage] = useState('javascript');
  const [theme, setTheme] = useState('vs-dark');

  return (
    <div className="flex h-full">
      {/* Editor */}
      <div className="flex-1">
        <EditorControls
          onLanguageChange={setLanguage}
          onThemeChange={setTheme}
        />
        <MonacoEditorWrapper
          language={language}
          theme={theme}
        />
      </div>

      {/* Sidebar */}
      <div className="w-64 border-l">
        <ConnectionStatus />
        <ParticipantsList />
      </div>
    </div>
  );
};
```

## Performance Considerations

1. **Cursor Updates**: Debounced to reduce network traffic
2. **Operation Batching**: Could be implemented for frequently typed content
3. **Lazy Decoration Updates**: Monaco decorations updated on participation changes
4. **Memory Management**: Operation history pruned in production

## Security Notes

1. **Client ID**: Should be cryptographically unique
2. **User ID**: Verified server-side, not trusted from client
3. **Rate Limiting**: Applied server-side to prevent spam
4. **Validation**: All operations validated server-side

## Future Enhancements

1. **Comments/Annotations**: Collaborative comments on code
2. **Awareness**: Show what other users are viewing
3. **Conflict Markers**: Visual indicators for resolved conflicts
4. **Operation History**: Timeline view of edits
5. **Language Detection**: Auto-detect language from file extension
6. **Formatter Integration**: Prettier/Black integration
7. **Snippets**: Code snippet support for multiple users
8. **Bookmarks**: Collaborative bookmarks and breakpoints

## Troubleshooting

### Cursor positions incorrect

- Verify operation transformation logic
- Check if operations are applied in correct order
- Ensure version numbers match

### Document doesn't sync

- Check WebSocket connection status
- Verify message format matches protocol
- Check server-side OT state management

### Undo/Redo not working

- Verify operation is added to undo stack
- Check operation inverse calculation
- Ensure document content is updated correctly

## References

- [Operational Transformation - Google Docs](https://en.wikipedia.org/wiki/Operational_transformation)
- [Monaco Editor Documentation](https://microsoft.github.io/monaco-editor/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Redux Documentation](https://redux.js.org/)
