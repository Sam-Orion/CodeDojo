import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import ProviderConnectionModal from './ProviderConnectionModal';
import storageProviderReducer from '../store/slices/storageProviderSlice';
import authReducer from '../store/slices/authSlice';
import collaborationReducer from '../store/slices/collaborationSlice';
import filesReducer from '../store/slices/filesSlice';
import terminalReducer from '../store/slices/terminalSlice';
import aiReducer from '../store/slices/aiSlice';

vi.mock('../store/slices/storageProviderSlice', async () => {
  const actual = await vi.importActual('../store/slices/storageProviderSlice');
  return {
    ...actual,
    connectProvider: vi.fn(),
    disconnectProvider: vi.fn(),
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

describe('ProviderConnectionModal', () => {
  it('should render modal with provider options', () => {
    const store = createMockStore({
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
    });

    render(
      <Provider store={store}>
        <ProviderConnectionModal isOpen={true} onClose={vi.fn()} />
      </Provider>
    );

    expect(screen.getByText('Connect Storage Provider')).toBeInTheDocument();
    expect(screen.getByText('Google Drive')).toBeInTheDocument();
    expect(screen.getByText('OneDrive')).toBeInTheDocument();
    expect(screen.getByText('Local Storage')).toBeInTheDocument();
  });

  it('should display connect button when provider is not connected', () => {
    const store = createMockStore({
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
    });

    render(
      <Provider store={store}>
        <ProviderConnectionModal isOpen={true} onClose={vi.fn()} />
      </Provider>
    );

    const connectButton = screen.getByRole('button', { name: /Connect Account/i });
    expect(connectButton).toBeInTheDocument();
    expect(connectButton).not.toBeDisabled();
  });

  it('should handle provider selection', () => {
    const store = createMockStore({
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
    });

    const { container } = render(
      <Provider store={store}>
        <ProviderConnectionModal isOpen={true} onClose={vi.fn()} />
      </Provider>
    );

    const radios = container.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBeGreaterThan(0);
  });

  it('should display error message when connectionError exists', () => {
    const store = createMockStore({
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
        connectionError: 'Failed to authenticate',
      },
    });

    render(
      <Provider store={store}>
        <ProviderConnectionModal isOpen={true} onClose={vi.fn()} />
      </Provider>
    );

    expect(screen.getByText('Failed to authenticate')).toBeInTheDocument();
  });

  it('should call onClose when cancel button is clicked', () => {
    const onClose = vi.fn();
    const store = createMockStore({
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
    });

    render(
      <Provider store={store}>
        <ProviderConnectionModal isOpen={true} onClose={onClose} />
      </Provider>
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalled();
  });
});
