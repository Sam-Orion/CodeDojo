import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import OAuthCallback from './OAuthCallback';
import storageProviderReducer from '../store/slices/storageProviderSlice';
import authReducer from '../store/slices/authSlice';
import collaborationReducer from '../store/slices/collaborationSlice';
import filesReducer from '../store/slices/filesSlice';
import terminalReducer from '../store/slices/terminalSlice';
import aiReducer from '../store/slices/aiSlice';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => {
      const params = new URLSearchParams(window.location.search);
      return [params, vi.fn()];
    },
    useNavigate: () => vi.fn(),
  };
});

const createMockStore = (preloadedState?: any) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      collaboration: collaborationReducer,
      files: filesReducer,
      terminal: terminalReducer,
      ai: aiReducer,
      storageProvider: storageProviderReducer,
    },
    preloadedState,
  });
};

const defaultPreloadedState: any = {
  auth: {
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  },
  collaboration: {
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
  },
  files: {
    root: null,
    currentFile: null,
    openFiles: [],
    isLoading: false,
    error: null,
  },
  terminal: {
    sessions: [],
    activeSession: null,
    isLoading: false,
    error: null,
    supportedLanguages: [],
  },
  ai: {
    conversations: [],
    activeConversation: null,
    isLoading: false,
    error: null,
  },
  storageProvider: {
    providers: [],
    currentProviderId: null,
    isLoading: false,
    error: null,
    isConnecting: false,
    connectionError: null,
  },
};

describe('OAuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show processing state initially', () => {
    const store = createMockStore(defaultPreloadedState);

    render(
      <Provider store={store}>
        <BrowserRouter>
          <OAuthCallback />
        </BrowserRouter>
      </Provider>
    );

    expect(screen.getByText('Connecting your storage provider...')).toBeInTheDocument();
  });

  it('should display error when no code is provided', async () => {
    const store = createMockStore(defaultPreloadedState);

    render(
      <Provider store={store}>
        <BrowserRouter>
          <OAuthCallback />
        </BrowserRouter>
      </Provider>
    );

    await waitFor(
      () => {
        expect(screen.getByText('No authorization code received')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('should display error parameter from OAuth provider', async () => {
    window.history.pushState(
      {},
      'Test',
      '?error=access_denied&error_description=User%20denied%20access'
    );

    const store = createMockStore(defaultPreloadedState);

    render(
      <Provider store={store}>
        <BrowserRouter>
          <OAuthCallback />
        </BrowserRouter>
      </Provider>
    );

    await waitFor(
      () => {
        expect(screen.getByText('User denied access')).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });
});
