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

const initialState: CollaborationState = {
  currentRoom: null,
  participants: [],
  isConnected: false,
  operationQueue: [],
};

const collaborationSlice = createSlice({
  name: 'collaboration',
  initialState,
  reducers: {
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    addOperation: (state, action: PayloadAction<Operation>) => {
      state.operationQueue.push(action.payload);
    },
    clearOperationQueue: (state) => {
      state.operationQueue = [];
    },
    updateParticipant: (state, action: PayloadAction<Participant>) => {
      const index = state.participants.findIndex((p) => p.id === action.payload.id);
      if (index !== -1) {
        state.participants[index] = action.payload;
      } else {
        state.participants.push(action.payload);
      }
    },
    removeParticipant: (state, action: PayloadAction<string>) => {
      state.participants = state.participants.filter((p) => p.id !== action.payload);
    },
    updateCursor: (
      state,
      action: PayloadAction<{ participantId: string; cursor: { line: number; column: number } }>
    ) => {
      const participant = state.participants.find((p) => p.id === action.payload.participantId);
      if (participant) {
        participant.cursor = action.payload.cursor;
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
        state.participants = action.payload.participants;
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
  addOperation,
  clearOperationQueue,
  updateParticipant,
  removeParticipant,
  updateCursor,
} = collaborationSlice.actions;

export default collaborationSlice.reducer;
