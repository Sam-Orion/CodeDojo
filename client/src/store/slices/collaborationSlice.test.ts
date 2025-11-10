import { describe, it, expect } from 'vitest';
import collaborationReducer, {
  setConnected,
  setConnectionStatus,
  addOperation,
  clearOperationQueue,
  addPendingOperation,
  removePendingOperation,
  setDocumentContent,
  updateDocumentVersion,
  addToOperationHistory,
  pushUndoOperation,
  pushRedoOperation,
  clearUndoRedo,
  updateParticipant,
  removeParticipant,
  updateCursor,
  updateSelection,
} from './collaborationSlice';
import { CollaborationState, Operation, Participant } from '../../types';

const getInitialState = (): CollaborationState => {
  return {
    currentRoom: null,
    participants: [],
    isConnected: false,
    operationQueue: [],
    documentContent: '',
    documentVersion: 0,
    operationHistory: [],
    pendingOperations: [],
    connectionStatus: 'idle',
    lastSyncTime: null,
    undoStack: [],
    redoStack: [],
  };
};

describe('collaborationSlice', () => {
  describe('connection state', () => {
    it('should set connected state', () => {
      const state = getInitialState();
      const newState = collaborationReducer(state, setConnected(true));
      expect(newState.isConnected).toBe(true);
      expect(newState.connectionStatus).toBe('connected');
    });

    it('should set disconnected state', () => {
      const state = getInitialState();
      const newState = collaborationReducer(state, setConnected(false));
      expect(newState.isConnected).toBe(false);
      expect(newState.connectionStatus).toBe('disconnected');
    });

    it('should set connection status', () => {
      const state = getInitialState();
      const newState = collaborationReducer(state, setConnectionStatus('connecting'));
      expect(newState.connectionStatus).toBe('connecting');
    });
  });

  describe('operations', () => {
    it('should add operation to queue', () => {
      const state = getInitialState();
      const operation: Operation = {
        id: '1',
        type: 'insert',
        position: 0,
        content: 'hello',
        clientId: 'client1',
        timestamp: Date.now(),
      };

      const newState = collaborationReducer(state, addOperation(operation));
      expect(newState.operationQueue).toHaveLength(1);
      expect(newState.operationQueue[0]).toBe(operation);
    });

    it('should clear operation queue', () => {
      const state = getInitialState();
      state.operationQueue = [
        {
          id: '1',
          type: 'insert',
          position: 0,
          content: 'hello',
          clientId: 'client1',
          timestamp: Date.now(),
        },
      ];

      const newState = collaborationReducer(state, clearOperationQueue());
      expect(newState.operationQueue).toHaveLength(0);
    });

    it('should add pending operation', () => {
      const state = getInitialState();
      const operation: Operation = {
        id: '1',
        type: 'insert',
        position: 0,
        content: 'hello',
        clientId: 'client1',
        timestamp: Date.now(),
      };

      const newState = collaborationReducer(state, addPendingOperation(operation));
      expect(newState.pendingOperations).toHaveLength(1);
    });

    it('should remove pending operation by id', () => {
      const state = getInitialState();
      state.pendingOperations = [
        {
          id: '1',
          type: 'insert',
          position: 0,
          content: 'hello',
          clientId: 'client1',
          timestamp: Date.now(),
        },
      ];

      const newState = collaborationReducer(state, removePendingOperation('1'));
      expect(newState.pendingOperations).toHaveLength(0);
    });
  });

  describe('document state', () => {
    it('should set document content', () => {
      const state = getInitialState();
      const newState = collaborationReducer(state, setDocumentContent('hello world'));
      expect(newState.documentContent).toBe('hello world');
      expect(newState.redoStack).toHaveLength(0);
    });

    it('should update document version', () => {
      const state = getInitialState();
      const newState = collaborationReducer(state, updateDocumentVersion(5));
      expect(newState.documentVersion).toBe(5);
      expect(newState.lastSyncTime).toBeTruthy();
    });

    it('should add to operation history', () => {
      const state = getInitialState();
      const operation: Operation = {
        id: '1',
        type: 'insert',
        position: 0,
        content: 'hello',
        clientId: 'client1',
        timestamp: Date.now(),
      };

      const newState = collaborationReducer(state, addToOperationHistory(operation));
      expect(newState.operationHistory).toHaveLength(1);
    });
  });

  describe('undo/redo', () => {
    it('should push operation to undo stack', () => {
      const state = getInitialState();
      const operation: Operation = {
        id: '1',
        type: 'insert',
        position: 0,
        content: 'hello',
        clientId: 'client1',
        timestamp: Date.now(),
      };

      const newState = collaborationReducer(state, pushUndoOperation(operation));
      expect(newState.undoStack).toHaveLength(1);
      expect(newState.redoStack).toHaveLength(0);
    });

    it('should push operation to redo stack', () => {
      const state = getInitialState();
      const operation: Operation = {
        id: '1',
        type: 'delete',
        position: 0,
        content: 'hello',
        clientId: 'client1',
        timestamp: Date.now(),
      };

      const newState = collaborationReducer(state, pushRedoOperation(operation));
      expect(newState.redoStack).toHaveLength(1);
    });

    it('should clear undo/redo stacks', () => {
      const state = getInitialState();
      state.undoStack = [
        {
          id: '1',
          type: 'insert',
          position: 0,
          content: 'hello',
          clientId: 'client1',
          timestamp: Date.now(),
        },
      ];
      state.redoStack = [
        {
          id: '2',
          type: 'delete',
          position: 0,
          content: 'hello',
          clientId: 'client1',
          timestamp: Date.now(),
        },
      ];

      const newState = collaborationReducer(state, clearUndoRedo());
      expect(newState.undoStack).toHaveLength(0);
      expect(newState.redoStack).toHaveLength(0);
    });
  });

  describe('participants', () => {
    it('should update or add participant', () => {
      const state = getInitialState();
      const participant: Participant = {
        id: 'p1',
        userId: 'user1',
        username: 'Alice',
        isActive: true,
        joinedAt: new Date().toISOString(),
      };

      const newState = collaborationReducer(state, updateParticipant(participant));
      expect(newState.participants).toHaveLength(1);
      expect(newState.participants[0].username).toBe('Alice');
      expect(newState.participants[0].color).toBeTruthy();
    });

    it('should remove participant by id', () => {
      const state = getInitialState();
      state.participants = [
        {
          id: 'p1',
          userId: 'user1',
          username: 'Alice',
          isActive: true,
          joinedAt: new Date().toISOString(),
          color: '#FF6B6B',
          lastActivity: Date.now(),
        },
      ];

      const newState = collaborationReducer(state, removeParticipant('p1'));
      expect(newState.participants).toHaveLength(0);
    });

    it('should update cursor position', () => {
      const state = getInitialState();
      state.participants = [
        {
          id: 'p1',
          userId: 'user1',
          username: 'Alice',
          isActive: true,
          joinedAt: new Date().toISOString(),
          color: '#FF6B6B',
          lastActivity: Date.now(),
        },
      ];

      const newState = collaborationReducer(
        state,
        updateCursor({
          participantId: 'p1',
          cursor: { line: 5, column: 10 },
        })
      );
      expect(newState.participants[0].cursor).toEqual({ line: 5, column: 10 });
    });

    it('should update selection', () => {
      const state = getInitialState();
      state.participants = [
        {
          id: 'p1',
          userId: 'user1',
          username: 'Alice',
          isActive: true,
          joinedAt: new Date().toISOString(),
          color: '#FF6B6B',
          lastActivity: Date.now(),
        },
      ];

      const newState = collaborationReducer(
        state,
        updateSelection({
          participantId: 'p1',
          selection: {
            startLine: 1,
            startColumn: 0,
            endLine: 1,
            endColumn: 10,
          },
        })
      );
      expect(newState.participants[0].selection).toBeTruthy();
    });
  });
});
