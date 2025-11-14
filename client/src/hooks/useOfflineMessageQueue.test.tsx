import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import { vi } from 'vitest';
import { useOfflineMessageQueue } from './useOfflineMessageQueue';
import aiSlice from '../store/slices/aiSlice';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    onLine: true,
  },
  writable: true,
});

// Mock fetch
global.fetch = vi.fn();

const createTestStore = () => {
  return configureStore({
    reducer: {
      ai: aiSlice,
    },
    preloadedState: {
      ai: {
        conversations: [],
        activeConversation: {
          id: 'test-conversation',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        isLoading: false,
        isSubmitting: false,
        error: null,
      },
    },
  });
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <Provider store={createTestStore()}>{children}</Provider>
);

describe('useOfflineMessageQueue', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    (navigator.onLine as boolean) = true;
  });

  it('should initialize with online status', () => {
    const { result } = renderHook(() => useOfflineMessageQueue(), { wrapper });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.queueSize).toBe(0);
    expect(result.current.queueFull).toBe(false);
  });

  it('should detect offline status', () => {
    const { result } = renderHook(() => useOfflineMessageQueue(), { wrapper });

    act(() => {
      // Simulate going offline
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        writable: true,
      });
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('should queue messages when offline', () => {
    const { result } = renderHook(() => useOfflineMessageQueue(), { wrapper });

    // Go offline
    act(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        writable: true,
      });
      window.dispatchEvent(new Event('offline'));
    });

    // Queue a message
    let messageId: string;
    act(() => {
      messageId = result.current.queueMessage('Test message');
    });

    expect(result.current.queueSize).toBe(1);
    expect(result.current.queueFull).toBe(false);
    expect(messageId).toMatch(/^queued-\d+-[a-z0-9]+$/);
  });

  it('should limit queue size', () => {
    const { result } = renderHook(() => useOfflineMessageQueue(), { wrapper });

    // Go offline
    act(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        writable: true,
      });
      window.dispatchEvent(new Event('offline'));
    });

    // Fill queue to max capacity
    act(() => {
      for (let i = 0; i < 50; i++) {
        result.current.queueMessage(`Message ${i}`);
      }
    });

    expect(result.current.queueSize).toBe(50);
    expect(result.current.queueFull).toBe(true);

    // Try to add one more message (should fail)
    expect(() => {
      result.current.queueMessage('Message 51');
    }).toThrow('Message queue is full');
  });

  it('should clear queue', () => {
    const { result } = renderHook(() => useOfflineMessageQueue(), { wrapper });

    // Go offline and add messages
    act(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        writable: true,
      });
      window.dispatchEvent(new Event('offline'));
      result.current.queueMessage('Test message 1');
      result.current.queueMessage('Test message 2');
    });

    expect(result.current.queueSize).toBe(2);

    // Clear queue
    act(() => {
      result.current.clearQueue();
    });

    expect(result.current.queueSize).toBe(0);
    expect(result.current.queueFull).toBe(false);
  });

  it('should persist queue to localStorage', () => {
    const { result } = renderHook(() => useOfflineMessageQueue(), { wrapper });

    // Go offline and add message
    act(() => {
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        writable: true,
      });
      window.dispatchEvent(new Event('offline'));
      result.current.queueMessage('Test message');
    });

    const stored = localStorageMock.getItem('ai_offline_message_queue');
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed.queuedMessages).toHaveLength(1);
    expect(parsed.queuedMessages[0].content).toBe('Test message');
  });
});
