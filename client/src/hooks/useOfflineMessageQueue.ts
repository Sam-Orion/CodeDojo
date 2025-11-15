import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { addUserMessage } from '../store/slices/aiSlice';

interface QueuedMessage {
  id: string;
  content: string;
  conversationId: string;
  timestamp: number;
  retryCount: number;
  provider?: string;
}

interface OfflineQueueState {
  isOnline: boolean;
  queuedMessages: QueuedMessage[];
  isRetrying: boolean;
  retryProgress: { current: number; total: number } | null;
  queueFull: boolean;
}

const OFFLINE_QUEUE_KEY = 'ai_offline_message_queue';
const MAX_QUEUE_SIZE = 50;
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export const useOfflineMessageQueue = () => {
  const dispatch = useAppDispatch();
  const { activeConversation } = useAppSelector((state) => state.ai);

  const [state, setState] = useState<OfflineQueueState>({
    isOnline: navigator.onLine,
    queuedMessages: [],
    isRetrying: false,
    retryProgress: null,
    queueFull: false,
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRetryingRef = useRef(false);

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState((prev) => ({
          ...prev,
          queuedMessages: parsed.queuedMessages || [],
          queueFull: (parsed.queuedMessages || []).length >= MAX_QUEUE_SIZE,
        }));
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(
        OFFLINE_QUEUE_KEY,
        JSON.stringify({
          queuedMessages: state.queuedMessages,
        })
      );
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }, [state.queuedMessages]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-retry when coming back online
  useEffect(() => {
    if (state.isOnline && state.queuedMessages.length > 0 && !isRetryingRef.current) {
      retryQueuedMessages();
    }
  }, [state.isOnline, state.queuedMessages.length, retryQueuedMessages]);

  const sendQueuedMessage = useCallback(async (message: QueuedMessage): Promise<boolean> => {
    try {
      const response = await fetch('/api/v1/ai/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: message.conversationId,
          content: message.content,
          provider: message.provider,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to send message');
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to send queued message ${message.id}:`, errorMessage);
      return false;
    }
  }, []);

  const retryQueuedMessages = useCallback(async () => {
    if (isRetryingRef.current || state.queuedMessages.length === 0) {
      return;
    }

    isRetryingRef.current = true;
    setState((prev) => ({
      ...prev,
      isRetrying: true,
      retryProgress: { current: 0, total: prev.queuedMessages.length },
    }));

    const messagesToRetry = [...state.queuedMessages];
    const successfulIds: string[] = [];
    const failedMessages: QueuedMessage[] = [];

    for (let i = 0; i < messagesToRetry.length; i++) {
      const message = messagesToRetry[i];

      setState((prev) => ({
        ...prev,
        retryProgress: { current: i + 1, total: messagesToRetry.length },
      }));

      const success = await sendQueuedMessage(message);

      if (success) {
        successfulIds.push(message.id);
      } else {
        const updatedMessage = {
          ...message,
          retryCount: message.retryCount + 1,
        };

        if (updatedMessage.retryCount < MAX_RETRIES) {
          // Calculate exponential backoff delay
          const delay = INITIAL_RETRY_DELAY * Math.pow(2, updatedMessage.retryCount);

          // Add delay before next retry
          await new Promise((resolve) => setTimeout(resolve, delay));

          failedMessages.push(updatedMessage);
        } else {
          // Max retries reached, remove from queue
          console.warn(
            `Message ${message.id} failed after ${MAX_RETRIES} retries, removing from queue`
          );
        }
      }
    }

    // Update state with results
    setState((prev) => {
      const remainingMessages = prev.queuedMessages.filter(
        (msg) => !successfulIds.includes(msg.id)
      );

      return {
        ...prev,
        queuedMessages: [...failedMessages, ...remainingMessages],
        isRetrying: false,
        retryProgress: null,
        queueFull: remainingMessages.length >= MAX_QUEUE_SIZE,
      };
    });

    isRetryingRef.current = false;
  }, [state.queuedMessages, sendQueuedMessage]);

  const queueMessage = useCallback(
    (content: string, provider?: string) => {
      if (!activeConversation) {
        throw new Error('No active conversation');
      }

      if (state.queuedMessages.length >= MAX_QUEUE_SIZE) {
        setState((prev) => ({ ...prev, queueFull: true }));
        throw new Error('Message queue is full. Please clear the queue and try again.');
      }

      const queuedMessage: QueuedMessage = {
        id: `queued-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content,
        conversationId: activeConversation.id,
        timestamp: Date.now(),
        retryCount: 0,
        provider,
      };

      setState((prev) => ({
        ...prev,
        queuedMessages: [...prev.queuedMessages, queuedMessage],
        queueFull: prev.queuedMessages.length + 1 >= MAX_QUEUE_SIZE,
      }));

      // Optimistically add user message to UI
      dispatch(
        addUserMessage({
          conversationId: activeConversation.id,
          content,
        })
      );

      return queuedMessage.id;
    },
    [activeConversation, state.queuedMessages.length, dispatch]
  );

  const clearQueue = useCallback(() => {
    setState((prev) => ({
      ...prev,
      queuedMessages: [],
      queueFull: false,
      retryProgress: null,
    }));

    try {
      localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } catch (error) {
      console.error('Failed to clear offline queue from storage:', error);
    }
  }, []);

  const removeFromQueue = useCallback((messageId: string) => {
    setState((prev) => {
      const updatedMessages = prev.queuedMessages.filter((msg) => msg.id !== messageId);
      return {
        ...prev,
        queuedMessages: updatedMessages,
        queueFull: updatedMessages.length >= MAX_QUEUE_SIZE,
      };
    });
  }, []);

  const retryNow = useCallback(() => {
    if (state.isOnline && state.queuedMessages.length > 0) {
      retryQueuedMessages();
    }
  }, [state.isOnline, state.queuedMessages.length, retryQueuedMessages]);

  // Cleanup timeout on unmount
  const cleanup = useCallback(() => {
    const currentTimeout = retryTimeoutRef.current;
    if (currentTimeout) {
      clearTimeout(currentTimeout);
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isOnline: state.isOnline,
    queuedMessages: state.queuedMessages,
    queueSize: state.queuedMessages.length,
    isRetrying: state.isRetrying,
    retryProgress: state.retryProgress,
    queueFull: state.queueFull,
    maxQueueSize: MAX_QUEUE_SIZE,
    queueMessage,
    clearQueue,
    removeFromQueue,
    retryNow,
  };
};
