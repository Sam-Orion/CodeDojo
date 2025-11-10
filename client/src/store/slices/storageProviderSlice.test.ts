import { describe, it, expect } from 'vitest';
import storageProviderReducer, {
  fetchProviders,
  connectProvider,
  disconnectProvider,
  refreshToken,
  setCurrentProvider,
  clearError,
  clearConnectionError,
  setCurrentProviderId,
  updateProviderLastAccessed,
} from './storageProviderSlice';
import { StorageProviderState, StorageProvider } from '../../types';

const mockProviders: StorageProvider[] = [
  {
    id: '1',
    type: 'google_drive',
    name: 'Google Drive',
    isConnected: true,
    email: 'user@gmail.com',
    token: 'token123',
    refreshToken: 'refresh123',
    expiresAt: Date.now() + 3600000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    type: 'onedrive',
    name: 'OneDrive',
    isConnected: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const createInitialState = (overrides?: Partial<StorageProviderState>): StorageProviderState => {
  return {
    providers: [],
    currentProviderId: null,
    isLoading: false,
    error: null,
    isConnecting: false,
    connectionError: null,
    ...overrides,
  };
};

describe('storageProviderSlice', () => {
  describe('reducers', () => {
    it('should handle clearError', () => {
      const initialState = createInitialState({ error: 'Some error' });
      const state = storageProviderReducer(initialState, clearError());
      expect(state.error).toBeNull();
    });

    it('should handle clearConnectionError', () => {
      const initialState = createInitialState({ connectionError: 'Connection failed' });
      const state = storageProviderReducer(initialState, clearConnectionError());
      expect(state.connectionError).toBeNull();
    });

    it('should handle setCurrentProviderId', () => {
      const initialState = createInitialState();
      const state = storageProviderReducer(initialState, setCurrentProviderId('provider-1'));
      expect(state.currentProviderId).toBe('provider-1');
    });

    it('should handle updateProviderLastAccessed', () => {
      const initialState = createInitialState({ providers: mockProviders });
      const beforeTime = Date.now();
      const state = storageProviderReducer(initialState, updateProviderLastAccessed('1'));
      const provider = state.providers.find((p) => p.id === '1');

      expect(provider?.lastAccessed).toBeDefined();
      expect(provider!.lastAccessed! >= beforeTime).toBe(true);
    });
  });

  describe('async thunks', () => {
    it('should handle fetchProviders fulfilled', () => {
      const state = storageProviderReducer(undefined, {
        type: fetchProviders.fulfilled.type,
        payload: mockProviders,
      } as any);

      expect(state.providers).toEqual(mockProviders);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.currentProviderId).toBe('1');
    });

    it('should handle connectProvider fulfilled', () => {
      const newProvider: StorageProvider = {
        id: '3',
        type: 'local',
        name: 'Local Storage',
        isConnected: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const initialState = createInitialState({
        providers: mockProviders,
        currentProviderId: '1',
        isConnecting: true,
      });

      const state = storageProviderReducer(initialState, {
        type: connectProvider.fulfilled.type,
        payload: newProvider,
      } as any);

      expect(state.providers).toContainEqual(newProvider);
      expect(state.isConnecting).toBe(false);
      expect(state.connectionError).toBeNull();
    });

    it('should handle disconnectProvider fulfilled', () => {
      const initialState = createInitialState({
        providers: mockProviders,
        currentProviderId: '1',
        isLoading: true,
      });

      const state = storageProviderReducer(initialState, {
        type: disconnectProvider.fulfilled.type,
        payload: '1',
      } as any);

      const provider = state.providers.find((p) => p.id === '1');
      expect(provider?.isConnected).toBe(false);
      expect(provider?.token).toBeUndefined();
      expect(state.isLoading).toBe(false);
    });

    it('should handle disconnectProvider rejected', () => {
      const error = new Error('Disconnect failed');
      const initialState = createInitialState({
        providers: mockProviders,
        currentProviderId: '1',
        isLoading: true,
      });

      const state = storageProviderReducer(initialState, {
        type: disconnectProvider.rejected.type,
        error,
      } as any);

      expect(state.error).toBe('Disconnect failed');
      expect(state.isLoading).toBe(false);
    });

    it('should handle refreshToken fulfilled', () => {
      const updatedProvider: StorageProvider = {
        ...mockProviders[0],
        token: 'new-token-456',
        expiresAt: Date.now() + 7200000,
      };

      const initialState = createInitialState({
        providers: mockProviders,
        currentProviderId: '1',
        isLoading: true,
      });

      const state = storageProviderReducer(initialState, {
        type: refreshToken.fulfilled.type,
        payload: updatedProvider,
      } as any);

      const provider = state.providers.find((p) => p.id === '1');
      expect(provider?.token).toBe('new-token-456');
      expect(state.isLoading).toBe(false);
    });

    it('should handle setCurrentProvider fulfilled', () => {
      const initialState = createInitialState({
        providers: mockProviders,
        currentProviderId: '1',
        isLoading: true,
      });

      const state = storageProviderReducer(initialState, {
        type: setCurrentProvider.fulfilled.type,
        payload: '2',
      } as any);

      expect(state.currentProviderId).toBe('2');
      expect(state.isLoading).toBe(false);
    });

    it('should handle pending states', () => {
      let state = storageProviderReducer(undefined, { type: fetchProviders.pending.type } as any);
      expect(state.isLoading).toBe(true);

      state = storageProviderReducer(undefined, { type: connectProvider.pending.type } as any);
      expect(state.isConnecting).toBe(true);
    });

    it('should handle rejected states', () => {
      const error = new Error('Fetch failed');
      let state = storageProviderReducer(undefined, {
        type: fetchProviders.rejected.type,
        error,
      } as any);
      expect(state.error).toBe('Fetch failed');
      expect(state.isLoading).toBe(false);

      state = storageProviderReducer(undefined, {
        type: connectProvider.rejected.type,
        error,
      } as any);
      expect(state.connectionError).toBe('Fetch failed');
      expect(state.isConnecting).toBe(false);
    });
  });

  describe('state transitions', () => {
    it('should handle provider connection and disconnection flow', () => {
      let state = createInitialState();

      state = storageProviderReducer(state, { type: connectProvider.pending.type } as any);
      expect(state.isConnecting).toBe(true);

      const newProvider: StorageProvider = {
        id: '1',
        type: 'google_drive',
        name: 'Google Drive',
        isConnected: true,
        email: 'user@gmail.com',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      state = storageProviderReducer(state, {
        type: connectProvider.fulfilled.type,
        payload: newProvider,
      } as any);

      expect(state.providers).toContainEqual(newProvider);
      expect(state.currentProviderId).toBe('1');

      state = storageProviderReducer(state, {
        type: disconnectProvider.fulfilled.type,
        payload: '1',
      } as any);

      const provider = state.providers.find((p) => p.id === '1');
      expect(provider?.isConnected).toBe(false);
    });
  });
});
