import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { User, AuthState } from '../../types';
import { ApiResponse } from '../../types';

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials: { username: string; password: string }) => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const data: ApiResponse<{ user: User; token: string }> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Login failed');
    }

    // Store token in localStorage
    localStorage.setItem('auth_token', data.data.token);
    return data.data;
  }
);

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await fetch('/api/v1/auth/logout', { method: 'POST' });
  localStorage.removeItem('auth_token');
});

export const refreshAuth = createAsyncThunk('auth/refresh', async () => {
  const token = localStorage.getItem('auth_token');
  if (!token) {
    throw new Error('No token found');
  }

  const response = await fetch('/api/v1/auth/refresh', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data: ApiResponse<{ user: User; token: string }> = await response.json();

  if (!data.success || !data.data) {
    localStorage.removeItem('auth_token');
    throw new Error(data.error || 'Token refresh failed');
  }

  localStorage.setItem('auth_token', data.data.token);
  return data.data;
});

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('auth_token'),
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setAuthFromStorage: (state) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        state.token = token;
        state.isAuthenticated = true;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Login failed';
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      })
      // Logout
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Logout failed';
      })
      // Refresh
      .addCase(refreshAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.error = null;
      })
      .addCase(refreshAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = action.error.message || 'Token refresh failed';
      });
  },
});

export const { clearError, setAuthFromStorage } = authSlice.actions;
export default authSlice.reducer;
