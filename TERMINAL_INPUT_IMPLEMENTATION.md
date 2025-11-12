# Terminal Input and Command Execution Implementation

This document describes the implementation of terminal input handling, command execution, and WebSocket communication features.

## Overview

The implementation provides a comprehensive terminal input system with the following capabilities:

- Command input with history navigation
- Autocomplete suggestions
- Execution mode selection (Local, Cloud, Auto)
- Command validation and sanitization
- Timeout handling with user warnings
- Abort/interrupt functionality for running commands
- Real-time output streaming via WebSocket

## Features Implemented

### 1. Command History Management (`commandHistory.ts`)

Located at: `client/src/utils/commandHistory.ts`

**Features:**

- Stores up to 100 commands in localStorage with 30-day expiry
- Navigation with up/down arrow keys
- Search functionality for finding previous commands
- Automatic cleanup of expired entries

**Usage:**

```typescript
import commandHistory from '../utils/commandHistory';

// Add command to history
commandHistory.add('ls -la', 'bash');

// Navigate history
const prev = commandHistory.getPrevious();
const next = commandHistory.getNext();

// Search history
const results = commandHistory.search('grep', 10);

// Clear history
commandHistory.clear();
```

### 2. Command Validation (`commandValidator.ts`)

Located at: `client/src/utils/commandValidator.ts`

**Features:**

- Validates command length (max 10,000 characters)
- Blocks dangerous patterns (rm -rf, mkfs, fork bombs, eval, exec, etc.)
- Provides warnings for long command chains, sudo usage, and output redirection to /dev/null
- Returns validation results with error messages and warnings

**Usage:**

```typescript
import commandValidator from '../utils/commandValidator';

const validation = commandValidator.validate('ls -la');
if (validation.valid) {
  console.log('Command is safe to execute');
  if (validation.warnings) {
    console.warn('Warnings:', validation.warnings);
  }
} else {
  console.error('Error:', validation.error);
}
```

### 3. Command Execution Hook (`useCommandExecution.ts`)

Located at: `client/src/hooks/useCommandExecution.ts`

**Features:**

- Manages execution state (isExecuting, isTimeout)
- 30-second default timeout with 10-second warning period
- Abort support via Ctrl+C signal
- Timeout and warning state tracking

**Usage:**

```typescript
import { useCommandExecution } from '../hooks/useCommandExecution';

const { executionState, executeCommand, abortExecution } = useCommandExecution(wsManager, 30000);

// Execute command
executeCommand(sessionId, 'npm start');

// Abort execution
abortExecution(sessionId);

// Check state
if (executionState.isExecuting) {
  console.log('Command is running');
}
if (executionState.isTimeout) {
  console.warn('Long-running command');
}
```

### 4. Command History Hook (`useCommandHistory.ts`)

Located at: `client/src/hooks/useCommandHistory.ts`

**Features:**

- Provides React hook interface for command history management
- Includes search, navigation, and history management

**Usage:**

```typescript
import { useCommandHistory } from '../hooks/useCommandHistory';

const { addToHistory, getPrevious, getNext, searchHistory, clearHistory } = useCommandHistory();
```

### 5. Terminal Input Component (`TerminalInput.tsx`)

Located at: `client/src/components/terminal/TerminalInput.tsx`

**Features:**

- **Command Input Field:** Text input with validation error display
- **History Navigation:** Up/down arrow keys navigate command history
- **Autocomplete Suggestions:** Language-specific command suggestions
- **Execution Modes:** Dropdown to select local, cloud, or auto execution
- **Submit/Abort Buttons:** Execute or stop running commands
- **Timeout Warning:** Banner displaying when command execution is taking too long
- **Validation Errors:** Clear error messages for invalid commands
- **Help Text:** Guidance on keyboard shortcuts

**Language-Specific Suggestions:**

- **Bash:** ls, pwd, cd, mkdir, cat, grep, find, echo
- **Python:** print(), import, def, class, for, if, len(), range()
- **JavaScript:** console.log(), const, let, function, return, async, await, class

**Keyboard Shortcuts:**

- `↑` / `↓`: Navigate command history
- `Enter`: Execute command
- `Esc` (when executing): Abort command
- `Esc` (when suggestions visible): Close suggestions

**Props:**

```typescript
interface TerminalInputProps {
  onSubmit: (command: string, mode: ExecutionMode) => void;
  isExecuting: boolean;
  isTimeout: boolean;
  onAbort?: () => void;
  language?: string;
}

type ExecutionMode = 'local' | 'cloud' | 'auto';
```

### 6. Terminal Component Integration

Updated: `client/src/components/terminal/TerminalComponent.tsx`

**Changes:**

- Integrated TerminalInput component
- Added command execution state management
- Added WebSocket manager support
- Handles command submission and abort events

### 7. Terminal Routes (Server-side)

Updated: `server/src/routes/terminal.routes.js`

**New Endpoints:**

**POST /api/v1/terminal/sessions**

- Create a new terminal session
- Request body: `{ language, file?, workspaceDir?, mode?, env? }`
- Returns session data

**POST /api/v1/terminal/sessions/:sessionId/input**

- Send input/command to terminal session
- Request body: `{ input }`
- Validates and sanitizes input

**POST /api/v1/terminal/sessions/:sessionId/abort**

- Send Ctrl+C signal to abort running command
- Returns success response

**POST /api/v1/terminal/validate-command**

- Validate command before execution (optional)
- Request body: `{ command }`
- Returns validation result

## CSS Styling

Added comprehensive styling in: `client/src/components/terminal/terminal.css`

**Classes:**

- `.terminal-input-container`: Main input container
- `.terminal-input-field`: Text input field
- `.terminal-input-controls`: Control buttons row
- `.terminal-execution-mode`: Mode selector dropdown
- `.terminal-input-submit-button`: Execute button
- `.terminal-input-abort-button`: Abort button
- `.terminal-suggestions`: Autocomplete dropdown
- `.terminal-suggestion-item`: Individual suggestion
- `.terminal-timeout-warning`: Timeout warning banner
- `.terminal-input-validation-error`: Error display
- `.terminal-input-help`: Help text

## TypeScript Types

Added to: `client/src/types/index.ts`

```typescript
type ExecutionMode = 'local' | 'cloud' | 'auto';

interface TerminalSession {
  id: string;
  language: string;
  mode: ExecutionMode;
  status: 'running' | 'stopped' | 'error';
  output: string[];
  env: Record<string, string>;
  createdAt: string;
  lastActivity: string;
  currentCommand?: string;
  isExecuting?: boolean;
}
```

## File Structure

```
client/src/
├── components/terminal/
│   ├── TerminalComponent.tsx      (Updated)
│   ├── TerminalInput.tsx          (New)
│   ├── TerminalManager.tsx        (Updated)
│   ├── TerminalPanel.tsx          (No changes)
│   ├── TerminalToolbar.tsx        (No changes)
│   ├── terminal.css               (Updated with input styles)
│   └── index.ts                   (Updated exports)
├── hooks/
│   ├── useCommandExecution.ts     (New)
│   └── useCommandHistory.ts       (New)
├── utils/
│   ├── commandHistory.ts          (New)
│   └── commandValidator.ts        (New)
└── types/
    └── index.ts                    (Updated)

server/src/
└── routes/
    └── terminal.routes.js         (Updated with new endpoints)
```

## Usage Example

```typescript
// In a React component
import { TerminalPanel } from '@/components/terminal';
import WebSocketManager from '@/utils/websocketManager';

function App() {
  const wsManager = new WebSocketManager();

  return (
    <div>
      <TerminalPanel wsManager={wsManager} defaultMode="auto" />
    </div>
  );
}
```

## Command Flow

1. **User Input** → Types command in TerminalInput field
2. **Validation** → commandValidator checks for dangerous patterns
3. **History** → commandHistory.add() saves to localStorage
4. **Execution** → useCommandExecution sends via WebSocket
5. **Timeout** → 10s warning, 30s abort after timeout
6. **Output** → Real-time streaming via WebSocket
7. **Abort** → Ctrl+C signal on abort button or Esc key

## Browser Compatibility

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Requires localStorage support
- Requires WebSocket support

## Performance Considerations

- Command history limited to 100 entries
- Suggestions filtered to 10 results max
- Autocomplete on-demand (only when typing)
- Debounced suggestion rendering
- Efficient CSS animations with hardware acceleration

## Security

- Command validation blocks dangerous patterns
- Input sanitization on server-side
- LocalStorage data scoped to browser origin
- No sensitive data stored in history
- Proper error handling without exposing system details
