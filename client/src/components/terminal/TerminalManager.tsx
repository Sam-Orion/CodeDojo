import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useAppSelector, useAppDispatch } from '../../store';
import { appendOutput, updateSessionStatus } from '../../store/slices/terminalSlice';
import TerminalComponent from './TerminalComponent';
import WebSocketManager from '../../utils/websocketManager';

interface TerminalManagerProps {
  sessionId?: string;
  wsManager?: WebSocketManager;
}

const TerminalManager: React.FC<TerminalManagerProps> = ({ sessionId, wsManager }) => {
  const dispatch = useAppDispatch();
  const { sessions, activeSession } = useAppSelector((state) => state.terminal);

  const internalManager = useMemo(() => wsManager ?? new WebSocketManager(), [wsManager]);
  const [isConnecting, setIsConnecting] = useState(!internalManager.isConnected());
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const currentSession = sessionId
    ? sessions.find((s) => s.id === sessionId)
    : activeSession || sessions[0];

  useEffect(() => {
    return () => {
      if (!wsManager) {
        internalManager.disconnect();
      }
    };
  }, [internalManager, wsManager]);

  useEffect(() => {
    if (!currentSession) {
      return;
    }

    let isSubscribed = true;

    const handleTerminalOutput = (payload: { sessionId: string; data: string }) => {
      if (payload.sessionId === currentSession.id) {
        dispatch(
          appendOutput({
            sessionId: payload.sessionId,
            output: payload.data,
          })
        );
      }
    };

    const handleTerminalExit = (payload: {
      sessionId: string;
      code: number;
      signal: string | null;
    }) => {
      if (payload.sessionId === currentSession.id) {
        dispatch(
          updateSessionStatus({
            sessionId: payload.sessionId,
            status: payload.code === 0 ? 'stopped' : 'error',
          })
        );
      }
    };

    const handleTerminalError = (payload: { sessionId: string; error: string }) => {
      if (payload.sessionId === currentSession.id && isSubscribed) {
        setConnectionError(payload.error);
        dispatch(
          updateSessionStatus({
            sessionId: payload.sessionId,
            status: 'error',
          })
        );
      }
    };

    const unsubscribeOutput = internalManager.on('TERMINAL_OUTPUT', handleTerminalOutput);
    const unsubscribeExit = internalManager.on('TERMINAL_EXIT', handleTerminalExit);
    const unsubscribeError = internalManager.on('TERMINAL_ERROR', handleTerminalError);

    const connect = async () => {
      if (internalManager.isConnected()) {
        setIsConnecting(false);
        setConnectionError(null);
        return;
      }

      setIsConnecting(true);
      setConnectionError(null);

      try {
        await internalManager.connect();
        if (!isSubscribed) {
          return;
        }
        setIsConnecting(false);
        setConnectionError(null);
      } catch (error) {
        if (!isSubscribed) {
          return;
        }
        setIsConnecting(false);
        setConnectionError(
          error instanceof Error ? error.message : 'Failed to connect to terminal session'
        );
      }
    };

    connect();

    return () => {
      isSubscribed = false;
      unsubscribeOutput();
      unsubscribeExit();
      unsubscribeError();
    };
  }, [currentSession, internalManager, dispatch]);

  const handleInput = useCallback(
    (input: string) => {
      if (currentSession) {
        internalManager.send({
          type: 'TERMINAL_INPUT',
          payload: {
            sessionId: currentSession.id,
            data: input,
          },
        });
      }
    },
    [internalManager, currentSession]
  );

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (currentSession) {
        internalManager.send({
          type: 'TERMINAL_RESIZE',
          payload: {
            sessionId: currentSession.id,
            cols,
            rows,
          },
        });
      }
    },
    [internalManager, currentSession]
  );

  if (!currentSession) {
    return (
      <div className="terminal-empty-state">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
        <h3>No Terminal Session</h3>
        <p>Create a new terminal session to get started</p>
      </div>
    );
  }

  return (
    <TerminalComponent
      key={currentSession.id}
      session={currentSession}
      onInput={handleInput}
      onResize={handleResize}
      isConnecting={isConnecting}
      connectionError={connectionError}
    />
  );
};

export default TerminalManager;
