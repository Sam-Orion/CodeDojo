import { useCallback, useRef, useState } from 'react';
import WebSocketManager from '../utils/websocketManager';

interface ExecutionState {
  isExecuting: boolean;
  isTimeout: boolean;
  abortController: AbortController | null;
  executionStartTime: number | null;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const TIMEOUT_WARNING = 10000; // 10 seconds

export const useCommandExecution = (
  wsManager: WebSocketManager,
  timeoutDuration = DEFAULT_TIMEOUT
) => {
  const [executionState, setExecutionState] = useState<ExecutionState>({
    isExecuting: false,
    isTimeout: false,
    abortController: null,
    executionStartTime: null,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimeouts = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
  }, []);

  const executeCommand = useCallback(
    (sessionId: string, command: string): void => {
      setExecutionState({
        isExecuting: true,
        isTimeout: false,
        abortController: null,
        executionStartTime: Date.now(),
      });

      wsManager.send({
        type: 'TERMINAL_INPUT',
        payload: {
          sessionId,
          data: command + '\n',
        },
      });

      // Set warning timeout
      warningTimeoutRef.current = setTimeout(() => {
        setExecutionState((prev) => ({
          ...prev,
          isTimeout: true,
        }));
      }, TIMEOUT_WARNING);

      // Set execution timeout
      timeoutRef.current = setTimeout(() => {
        setExecutionState({
          isExecuting: false,
          isTimeout: true,
          abortController: null,
          executionStartTime: null,
        });
        clearTimeouts();
      }, timeoutDuration);
    },
    [wsManager, timeoutDuration, clearTimeouts]
  );

  const abortExecution = useCallback(
    (sessionId: string): void => {
      clearTimeouts();
      wsManager.send({
        type: 'TERMINAL_INPUT',
        payload: {
          sessionId,
          data: '\u0003', // Send Ctrl+C
        },
      });
      setExecutionState({
        isExecuting: false,
        isTimeout: false,
        abortController: null,
        executionStartTime: null,
      });
    },
    [wsManager, clearTimeouts]
  );

  const resetExecution = useCallback(() => {
    clearTimeouts();
    setExecutionState({
      isExecuting: false,
      isTimeout: false,
      abortController: null,
      executionStartTime: null,
    });
  }, [clearTimeouts]);

  return {
    executionState,
    executeCommand,
    abortExecution,
    resetExecution,
    clearTimeouts,
  };
};
