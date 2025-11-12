import React, { useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { setActiveSession, terminateTerminalSession } from '../../store/slices/terminalSlice';
import { addToast } from '../../store/slices/toastSlice';
import TerminalManager from './TerminalManager';
import SplitTerminal from './SplitTerminal';
import SessionCreateModal from './SessionCreateModal';
import SessionHistory from './SessionHistory';
import WebSocketManager from '../../utils/websocketManager';
import './terminal.css';

interface TerminalPanelProps {
  wsManager?: WebSocketManager;
  defaultMode?: 'local' | 'cloud' | 'auto';
  enableSplitView?: boolean;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({
  wsManager,
  defaultMode = 'auto',
  enableSplitView = false,
}) => {
  const dispatch = useAppDispatch();
  const { sessions, activeSession, supportedLanguages } = useAppSelector((state) => state.terminal);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSessionHistory, setShowSessionHistory] = useState(false);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);
  const [useSplitView, setUseSplitView] = useState(false);

  const handleCreateSession = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleCloseSession = useCallback(
    async (sessionId: string, event: React.MouseEvent) => {
      event.stopPropagation();

      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      try {
        await dispatch(terminateTerminalSession(sessionId)).unwrap();

        dispatch(
          addToast({
            message: `Terminal session "${session.language}" closed`,
            type: 'success',
          })
        );
      } catch (error) {
        dispatch(
          addToast({
            message: `Failed to close terminal session: ${error}`,
            type: 'error',
          })
        );
      }
    },
    [dispatch, sessions]
  );

  const handleSessionTabClick = useCallback(
    (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId);
      if (session) {
        dispatch(setActiveSession(session));
      }
    },
    [sessions, dispatch]
  );

  const handleDragStart = useCallback((sessionId: string) => {
    setDraggedTab(sessionId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetSessionId: string) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedTab || draggedTab === targetSessionId) {
        setDraggedTab(null);
        return;
      }

      // This would require updating the Redux store to support reordering
      // For now, we'll just clear the dragged state
      setDraggedTab(null);
    },
    [draggedTab]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedTab(null);
  }, []);

  return (
    <div className="terminal-panel">
      {/* Terminal Tabs */}
      <div className="terminal-tabs">
        <div className="terminal-tabs-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`terminal-tab ${activeSession?.id === session.id ? 'terminal-tab-active' : ''} ${draggedTab === session.id ? 'terminal-tab-dragging' : ''}`}
              onClick={() => handleSessionTabClick(session.id)}
              draggable
              onDragStart={() => handleDragStart(session.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, session.id)}
              onDragEnd={handleDragEnd}
            >
              <span className="terminal-tab-icon">
                <svg
                  width="14"
                  height="14"
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
              </span>
              <span className="terminal-tab-label">{session.name || session.language}</span>
              <span
                className={`terminal-tab-status terminal-tab-status-${session.status}`}
                title={session.status}
              />
              <button
                className="terminal-tab-close"
                onClick={(e) => handleCloseSession(session.id, e)}
                title="Close terminal"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* New Terminal Button */}
        <div className="terminal-tabs-actions">
          {enableSplitView && (
            <button
              className="terminal-tab-split"
              onClick={() => setUseSplitView(!useSplitView)}
              title={useSplitView ? 'Unsplit terminal' : 'Split terminal'}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {useSplitView ? (
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                ) : (
                  <>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="12" y1="3" x2="12" y2="21" />
                  </>
                )}
              </svg>
            </button>
          )}
          <button
            className="terminal-tab-history"
            onClick={() => setShowSessionHistory(true)}
            title="Session history"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
          <button className="terminal-tab-new" onClick={handleCreateSession} title="New terminal">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Session Create Modal */}
      <SessionCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        defaultMode={defaultMode}
        supportedLanguages={
          supportedLanguages.length > 0
            ? supportedLanguages
            : ['bash', 'python', 'javascript', 'typescript', 'java', 'go', 'rust', 'ruby']
        }
      />

      {/* Session History Modal */}
      <SessionHistory
        isOpen={showSessionHistory}
        onClose={() => setShowSessionHistory(false)}
        onSelectSession={() => setShowSessionHistory(false)}
      />

      {/* Terminal Content */}
      <div className="terminal-panel-content">
        {sessions.length === 0 ? (
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
            <h3>No Terminal Sessions</h3>
            <p>Click the + button to create a new terminal session</p>
          </div>
        ) : enableSplitView && useSplitView ? (
          <SplitTerminal wsManager={wsManager} />
        ) : (
          <TerminalManager wsManager={wsManager} />
        )}
      </div>
    </div>
  );
};

export default TerminalPanel;
