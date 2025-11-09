import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { TerminalSession, TerminalState } from '../../types';
import { ApiResponse } from '../../types';

// Async thunks
export const fetchTerminalCapabilities = createAsyncThunk(
  'terminal/fetchCapabilities',
  async () => {
    const response = await fetch('/api/v1/terminal/capabilities');
    const data: ApiResponse<{ languages: string[] }> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch terminal capabilities');
    }

    return data.data.languages;
  }
);

export const createTerminalSession = createAsyncThunk(
  'terminal/createSession',
  async (config: {
    language: string;
    mode: 'local' | 'cloud' | 'auto';
    file?: string;
    env?: Record<string, string>;
  }) => {
    const response = await fetch('/api/v1/terminal/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data: ApiResponse<TerminalSession> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to create terminal session');
    }

    return data.data;
  }
);

export const fetchTerminalSessions = createAsyncThunk('terminal/fetchSessions', async () => {
  const response = await fetch('/api/v1/terminal/sessions');
  const data: ApiResponse<TerminalSession[]> = await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error || 'Failed to fetch terminal sessions');
  }

  return data.data;
});

export const terminateTerminalSession = createAsyncThunk(
  'terminal/terminateSession',
  async (sessionId: string) => {
    const response = await fetch(`/api/v1/terminal/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    const data: ApiResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to terminate terminal session');
    }

    return sessionId;
  }
);

export const sendTerminalInput = createAsyncThunk(
  'terminal/sendInput',
  async ({ sessionId, input }: { sessionId: string; input: string }) => {
    const response = await fetch(`/api/v1/terminal/sessions/${sessionId}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    const data: ApiResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to send terminal input');
    }

    return { sessionId, input };
  }
);

const initialState: TerminalState = {
  sessions: [],
  activeSession: null,
  isLoading: false,
  error: null,
  supportedLanguages: [],
};

const terminalSlice = createSlice({
  name: 'terminal',
  initialState,
  reducers: {
    setActiveSession: (state, action: PayloadAction<TerminalSession | null>) => {
      state.activeSession = action.payload;
    },
    appendOutput: (state, action: PayloadAction<{ sessionId: string; output: string }>) => {
      const session = state.sessions.find((s) => s.id === action.payload.sessionId);
      if (session) {
        session.output.push(action.payload.output);
        session.lastActivity = new Date().toISOString();
      }
      if (state.activeSession?.id === action.payload.sessionId) {
        state.activeSession.output.push(action.payload.output);
        state.activeSession.lastActivity = new Date().toISOString();
      }
    },
    updateSessionStatus: (
      state,
      action: PayloadAction<{ sessionId: string; status: 'running' | 'stopped' | 'error' }>
    ) => {
      const session = state.sessions.find((s) => s.id === action.payload.sessionId);
      if (session) {
        session.status = action.payload.status;
        session.lastActivity = new Date().toISOString();
      }
      if (state.activeSession?.id === action.payload.sessionId) {
        state.activeSession.status = action.payload.status;
        state.activeSession.lastActivity = new Date().toISOString();
      }
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Capabilities
      .addCase(fetchTerminalCapabilities.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTerminalCapabilities.fulfilled, (state, action) => {
        state.isLoading = false;
        state.supportedLanguages = action.payload;
        state.error = null;
      })
      .addCase(fetchTerminalCapabilities.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch terminal capabilities';
      })
      // Create Session
      .addCase(createTerminalSession.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createTerminalSession.fulfilled, (state, action) => {
        state.isLoading = false;
        state.sessions.push(action.payload);
        state.activeSession = action.payload;
        state.error = null;
      })
      .addCase(createTerminalSession.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create terminal session';
      })
      // Fetch Sessions
      .addCase(fetchTerminalSessions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTerminalSessions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.sessions = action.payload;
        state.error = null;
      })
      .addCase(fetchTerminalSessions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch terminal sessions';
      })
      // Terminate Session
      .addCase(terminateTerminalSession.fulfilled, (state, action) => {
        const sessionId = action.payload;
        state.sessions = state.sessions.filter((s) => s.id !== sessionId);
        if (state.activeSession?.id === sessionId) {
          state.activeSession = state.sessions.length > 0 ? state.sessions[0] : null;
        }
      })
      .addCase(terminateTerminalSession.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to terminate terminal session';
      })
      // Send Input
      .addCase(sendTerminalInput.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to send terminal input';
      });
  },
});

export const { setActiveSession, appendOutput, updateSessionStatus, clearError } =
  terminalSlice.actions;

export default terminalSlice.reducer;
