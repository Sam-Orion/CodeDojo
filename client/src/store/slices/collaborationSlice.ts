import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Room, Participant, CollaborationState, Operation } from '../../types';
import { ApiResponse } from '../../types';

// Async thunks
export const joinRoom = createAsyncThunk('collaboration/joinRoom', async (roomId: string) => {
  const response = await fetch(`/api/v1/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data: ApiResponse<Room> = await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error || 'Failed to join room');
  }

  return data.data;
});

export const leaveRoom = createAsyncThunk('collaboration/leaveRoom', async () => {
  const response = await fetch('/api/v1/rooms/leave', {
    method: 'POST',
  });
  const data: ApiResponse = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Failed to leave room');
  }

  return true;
});

export const fetchRooms = createAsyncThunk('collaboration/fetchRooms', async () => {
  const response = await fetch('/api/v1/rooms');
  const data: ApiResponse<Room[]> = await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error || 'Failed to fetch rooms');
  }

  return data.data;
});

// Participant color palette for multi-cursor rendering
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

const getParticipantColor = (index: number): string => {
  return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
};

const initialState: CollaborationState = {
  currentRoom: null,
  participants: [] as any,
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

const collaborationSlice = createSlice({
  name: 'collaboration',
  initialState,
  reducers: {
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
      state.connectionStatus = action.payload ? 'connected' : 'disconnected';
    },
    setConnectionStatus: (
      state,
      action: PayloadAction<'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'>
    ) => {
      state.connectionStatus = action.payload;
      if (action.payload === 'connected') {
        state.isConnected = true;
      } else if (action.payload === 'disconnected' || action.payload === 'error') {
        state.isConnected = false;
      }
    },
    addOperation: (state, action: PayloadAction<Operation>) => {
      state.operationQueue.push(action.payload);
    },
    clearOperationQueue: (state) => {
      state.operationQueue = [];
    },
    addPendingOperation: (state, action: PayloadAction<Operation>) => {
      state.pendingOperations.push(action.payload);
    },
    removePendingOperation: (state, action: PayloadAction<string>) => {
      state.pendingOperations = state.pendingOperations.filter((op) => op.id !== action.payload);
    },
    setDocumentContent: (state, action: PayloadAction<string>) => {
      state.documentContent = action.payload;
      state.redoStack = [];
    },
    updateDocumentVersion: (state, action: PayloadAction<number>) => {
      state.documentVersion = action.payload;
      state.lastSyncTime = Date.now();
    },
    addToOperationHistory: (state, action: PayloadAction<Operation>) => {
      state.operationHistory.push(action.payload);
    },
    pushUndoOperation: (state, action: PayloadAction<Operation>) => {
      state.undoStack.push(action.payload);
      state.redoStack = [];
    },
    pushRedoOperation: (state, action: PayloadAction<Operation>) => {
      state.redoStack.push(action.payload);
    },
    clearUndoRedo: (state) => {
      state.undoStack = [];
      state.redoStack = [];
    },
    updateParticipant: (state, action: PayloadAction<Participant>) => {
      const index = state.participants.findIndex((p: any) => p.id === action.payload.id);
      if (index !== -1) {
        state.participants[index] = {
          ...state.participants[index],
          ...action.payload,
          color: state.participants[index].color || getParticipantColor(index),
          lastActivity: state.participants[index].lastActivity || Date.now(),
        } as any;
      } else {
        const newParticipant: any = {
          ...action.payload,
          color: getParticipantColor(state.participants.length),
          lastActivity: Date.now(),
        };
        (state.participants as any).push(newParticipant);
      }
    },
    removeParticipant: (state, action: PayloadAction<string>) => {
      state.participants = state.participants.filter((p) => p.id !== action.payload);
    },
    updateCursor: (
      state,
      action: PayloadAction<{
        participantId: string;
        cursor: { line: number; column: number };
      }>
    ) => {
      const participant = state.participants.find((p) => p.id === action.payload.participantId);
      if (participant) {
        participant.cursor = action.payload.cursor;
        participant.lastActivity = Date.now();
      }
    },
    updateSelection: (
      state,
      action: PayloadAction<{
        participantId: string;
        selection: {
          startLine: number;
          startColumn: number;
          endLine: number;
          endColumn: number;
        };
      }>
    ) => {
      const participant = state.participants.find((p) => p.id === action.payload.participantId);
      if (participant) {
        participant.selection = action.payload.selection;
        participant.lastActivity = Date.now();
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Join Room
      .addCase(joinRoom.pending, () => {
        // Could add loading state here if needed
      })
      .addCase(joinRoom.fulfilled, (state, action) => {
        state.currentRoom = action.payload;
        state.participants = action.payload.participants as any;
      })
      .addCase(joinRoom.rejected, (_, action) => {
        console.error('Failed to join room:', action.error.message);
      })
      // Leave Room
      .addCase(leaveRoom.fulfilled, (state) => {
        state.currentRoom = null;
        state.participants = [];
        state.operationQueue = [];
      })
      .addCase(leaveRoom.rejected, (_, action) => {
        console.error('Failed to leave room:', action.error.message);
      });
  },
});

export const {
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
} = collaborationSlice.actions;

export default collaborationSlice.reducer;
