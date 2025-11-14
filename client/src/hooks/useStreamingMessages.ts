import { useCallback, useRef, useState } from 'react';
import { useAppDispatch } from '../store';
import {
  updateStreamingMessage,
  completeStreamingMessage,
  clearStreamingState,
} from '../store/slices/aiSlice';
import type { AIMessage } from '../types';

interface StreamingOptions {
  conversationId: string;
  content: string;
  provider?: string;
}

interface StreamingState {
  isStreaming: boolean;
  error: string | null;
  tokenCount: number;
  controller: AbortController | null;
}

interface StreamEvent {
  type: 'token' | 'done' | 'error' | 'metadata';
  token?: string;
  error?: string;
  tokenCount?: number;
  messageId?: string;
}

export const useStreamingMessages = () => {
  const dispatch = useAppDispatch();
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    error: null,
    tokenCount: 0,
    controller: null,
  });

  const streamingMessageRef = useRef<Partial<AIMessage>>({});
  const retryCountRef = useRef(0);
  const maxRetriesRef = useRef(3);

  const startStream = useCallback(
    async (options: StreamingOptions) => {
      const { conversationId, content, provider } = options;

      // Clear previous streaming state
      dispatch(clearStreamingState({ conversationId }));
      setState({
        isStreaming: true,
        error: null,
        tokenCount: 0,
        controller: null,
      });

      // Initialize message for streaming
      const messageId = `stream-${Date.now()}`;
      streamingMessageRef.current = {
        id: messageId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        status: 'pending',
        isStreaming: true,
      };

      const controller = new AbortController();
      setState((prev) => ({ ...prev, controller }));

      try {
        const response = await fetch('/api/v1/ai/messages/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId,
            content,
            provider,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        retryCountRef.current = 0;

        let done = false;
        while (!done) {
          const result = await reader.read();
          done = result.done;
          const value = result.value;

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const event: StreamEvent = JSON.parse(data);

              if (event.type === 'token') {
                if (event.token) {
                  streamingMessageRef.current.content =
                    (streamingMessageRef.current.content || '') + event.token;

                  dispatch(
                    updateStreamingMessage({
                      conversationId,
                      messageId,
                      content: streamingMessageRef.current.content,
                      tokenCount:
                        event.tokenCount || streamingMessageRef.current.content?.length || 0,
                    })
                  );
                }
              } else if (event.type === 'metadata') {
                if (event.tokenCount !== undefined) {
                  setState((prev) => ({ ...prev, tokenCount: event.tokenCount! }));
                }
              } else if (event.type === 'error') {
                throw new Error(event.error || 'Stream error');
              }
            } catch {
              // Continue on parse errors
              continue;
            }
          }
        }

        // Handle any remaining buffer
        if (buffer && buffer.startsWith('data: ')) {
          const data = buffer.slice(6).trim();
          if (data) {
            try {
              const event: StreamEvent = JSON.parse(data);
              if (event.type === 'token' && event.token) {
                streamingMessageRef.current.content =
                  (streamingMessageRef.current.content || '') + event.token;
              }
            } catch {
              // Ignore final buffer parse errors
            }
          }
        }

        // Complete streaming
        dispatch(
          completeStreamingMessage({
            conversationId,
            messageId,
            content: streamingMessageRef.current.content || '',
            status: 'success',
            tokenCount: state.tokenCount,
          })
        );

        setState({
          isStreaming: false,
          error: null,
          tokenCount: state.tokenCount,
          controller: null,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Streaming error occurred';

        // Handle abort separately
        if (error instanceof Error && error.name === 'AbortError') {
          setState({
            isStreaming: false,
            error: null,
            tokenCount: state.tokenCount,
            controller: null,
          });
          return;
        }

        // Retry logic for connection drops
        if (retryCountRef.current < maxRetriesRef.current) {
          retryCountRef.current += 1;
          const delay = Math.pow(2, retryCountRef.current) * 1000; // Exponential backoff

          setState({
            isStreaming: true,
            error: null,
            tokenCount: state.tokenCount,
            controller: null,
          });

          // Wait and retry
          await new Promise((resolve) => setTimeout(resolve, delay));
          return startStream(options);
        }

        // Final failure - mark message with error but preserve partial content
        dispatch(
          completeStreamingMessage({
            conversationId,
            messageId,
            content: streamingMessageRef.current.content || '',
            status: 'error',
            tokenCount: state.tokenCount,
            errorDetails: errorMessage,
          })
        );

        setState({
          isStreaming: false,
          error: errorMessage,
          tokenCount: state.tokenCount,
          controller: null,
        });
      }
    },
    [dispatch, state.tokenCount]
  );

  const stopStream = useCallback(() => {
    if (state.controller) {
      state.controller.abort();
    }
    setState({
      isStreaming: false,
      error: null,
      tokenCount: state.tokenCount,
      controller: null,
    });
  }, [state.controller, state.tokenCount]);

  return {
    startStream,
    stopStream,
    isStreaming: state.isStreaming,
    error: state.error,
    tokenCount: state.tokenCount,
  };
};
