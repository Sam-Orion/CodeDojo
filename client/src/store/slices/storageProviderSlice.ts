import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { StorageProvider, StorageProviderState } from '../../types';
import { ApiResponse } from '../../types';

export const fetchProviders = createAsyncThunk('storageProvider/fetchProviders', async () => {
  const response = await fetch('/api/v1/storage/providers');
  const data: ApiResponse<{ providers: StorageProvider[] }> = await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error || 'Failed to fetch storage providers');
  }

  return data.data.providers;
});

export const connectProvider = createAsyncThunk(
  'storageProvider/connect',
  async ({ type, code }: { type: string; code: string }) => {
    const response = await fetch('/api/v1/storage/providers/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, code }),
    });
    const data: ApiResponse<{ provider: StorageProvider }> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to connect storage provider');
    }

    return data.data.provider;
  }
);

export const disconnectProvider = createAsyncThunk(
  'storageProvider/disconnect',
  async (providerId: string) => {
    const response = await fetch(`/api/v1/storage/providers/${providerId}/disconnect`, {
      method: 'POST',
    });
    const data: ApiResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to disconnect storage provider');
    }

    return providerId;
  }
);

export const refreshToken = createAsyncThunk(
  'storageProvider/refreshToken',
  async (providerId: string) => {
    const response = await fetch(`/api/v1/storage/providers/${providerId}/refresh-token`, {
      method: 'POST',
    });
    const data: ApiResponse<{ provider: StorageProvider }> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to refresh token');
    }

    return data.data.provider;
  }
);

export const setCurrentProvider = createAsyncThunk(
  'storageProvider/setCurrentProvider',
  async (providerId: string) => {
    const response = await fetch(`/api/v1/storage/providers/${providerId}/set-current`, {
      method: 'POST',
    });
    const data: ApiResponse = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to set current provider');
    }

    return providerId;
  }
);

const initialState: StorageProviderState = {
  providers: [],
  currentProviderId: null,
  isLoading: false,
  error: null,
  isConnecting: false,
  connectionError: null,
};

const storageProviderSlice = createSlice({
  name: 'storageProvider',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearConnectionError: (state) => {
      state.connectionError = null;
    },
    setCurrentProviderId: (state, action: PayloadAction<string | null>) => {
      state.currentProviderId = action.payload;
    },
    updateProviderLastAccessed: (state, action: PayloadAction<string>) => {
      const provider = state.providers.find((p) => p.id === action.payload);
      if (provider) {
        provider.lastAccessed = Date.now();
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Providers
      .addCase(fetchProviders.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchProviders.fulfilled, (state, action) => {
        state.isLoading = false;
        state.providers = action.payload;
        state.error = null;

        const connected = state.providers.find((p) => p.isConnected);
        if (connected && !state.currentProviderId) {
          state.currentProviderId = connected.id;
        }
      })
      .addCase(fetchProviders.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch providers';
      })
      // Connect Provider
      .addCase(connectProvider.pending, (state) => {
        state.isConnecting = true;
        state.connectionError = null;
      })
      .addCase(connectProvider.fulfilled, (state, action) => {
        state.isConnecting = false;
        state.connectionError = null;

        const existingIndex = state.providers.findIndex((p) => p.id === action.payload.id);
        if (existingIndex >= 0) {
          state.providers[existingIndex] = action.payload;
        } else {
          state.providers.push(action.payload);
        }

        if (!state.currentProviderId) {
          state.currentProviderId = action.payload.id;
        }
      })
      .addCase(connectProvider.rejected, (state, action) => {
        state.isConnecting = false;
        state.connectionError = action.error.message || 'Failed to connect provider';
      })
      // Disconnect Provider
      .addCase(disconnectProvider.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(disconnectProvider.fulfilled, (state, action) => {
        state.isLoading = false;
        state.error = null;

        const provider = state.providers.find((p) => p.id === action.payload);
        if (provider) {
          provider.isConnected = false;
          provider.token = undefined;
          provider.refreshToken = undefined;
          provider.expiresAt = undefined;
        }

        if (state.currentProviderId === action.payload) {
          const connected = state.providers.find((p) => p.isConnected);
          state.currentProviderId = connected?.id || null;
        }
      })
      .addCase(disconnectProvider.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to disconnect provider';
      })
      // Refresh Token
      .addCase(refreshToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.isLoading = false;
        const existingIndex = state.providers.findIndex((p) => p.id === action.payload.id);
        if (existingIndex >= 0) {
          state.providers[existingIndex] = action.payload;
        }
      })
      .addCase(refreshToken.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to refresh token';
      })
      // Set Current Provider
      .addCase(setCurrentProvider.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(setCurrentProvider.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentProviderId = action.payload;
      })
      .addCase(setCurrentProvider.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to set current provider';
      });
  },
});

export const {
  clearError,
  clearConnectionError,
  setCurrentProviderId,
  updateProviderLastAccessed,
} = storageProviderSlice.actions;

export default storageProviderSlice.reducer;
