import React, { useState, useCallback } from 'react';
import { useAppDispatch } from '../../store';
import { createTerminalSession } from '../../store/slices/terminalSlice';
import { addToast } from '../../store/slices/toastSlice';
import sessionPersistence from '../../utils/sessionPersistence';
import './terminal.css';

interface SessionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: () => void;
}

interface PersistedSession {
  id: string;
  name?: string;
  language: string;
  mode: 'local' | 'cloud' | 'auto';
  status: 'running' | 'stopped' | 'error';
  env: Record<string, string>;
  createdAt: string;
  lastActivity: string;
}

const SessionHistory: React.FC<SessionHistoryProps> = ({ isOpen, onClose, onSelectSession }) => {
  const dispatch = useAppDispatch();
  const [isLoading, setIsLoading] = useState(false);
  const [recentSessions, setRecentSessions] = useState<PersistedSession[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      setRecentSessions(sessionPersistence.getRecentSessions(20));
    }
  }, [isOpen]);

  const handleRestoreSession = useCallback(
    async (session: PersistedSession) => {
      setIsLoading(true);

      try {
        await dispatch(
          createTerminalSession({
            language: session.language,
            mode: session.mode,
            env: Object.keys(session.env).length > 0 ? session.env : undefined,
          })
        ).unwrap();

        dispatch(
          addToast({
            message: `Session restored: ${session.name || session.language}`,
            type: 'success',
          })
        );

        onSelectSession();
        onClose();
      } catch (error) {
        dispatch(
          addToast({
            message: `Failed to restore session: ${error}`,
            type: 'error',
          })
        );
      } finally {
        setIsLoading(false);
      }
    },
    [dispatch, onSelectSession, onClose]
  );

  const handleClearHistory = useCallback(() => {
    sessionPersistence.clear();
    setRecentSessions([]);

    dispatch(
      addToast({
        message: 'Session history cleared',
        type: 'info',
      })
    );
  }, [dispatch]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="session-history-overlay">
      <div className="session-history-modal">
        <div className="session-history-header">
          <h3>Recent Sessions</h3>
          <div className="session-history-actions">
            <button
              type="button"
              className="session-history-clear"
              onClick={handleClearHistory}
              disabled={isLoading || recentSessions.length === 0}
            >
              Clear History
            </button>
            <button
              type="button"
              className="session-history-close"
              onClick={onClose}
              disabled={isLoading}
            >
              <svg
                width="20"
                height="20"
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
        </div>

        <div className="session-history-content">
          {recentSessions.length === 0 ? (
            <div className="session-history-empty">
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
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <h4>No Recent Sessions</h4>
              <p>Your recent terminal sessions will appear here</p>
            </div>
          ) : (
            <div className="session-history-list">
              {recentSessions.map((session) => (
                <div key={session.id} className="session-history-item">
                  <div className="session-history-info">
                    <div className="session-history-name">{session.name || session.language}</div>
                    <div className="session-history-details">
                      <span className="session-history-language">{session.language}</span>
                      <span className="session-history-mode">{session.mode}</span>
                      <span className="session-history-time">
                        {formatDate(session.lastActivity)}
                      </span>
                    </div>
                    {Object.keys(session.env).length > 0 && (
                      <div className="session-history-env">
                        {Object.keys(session.env).length} environment variable(s)
                      </div>
                    )}
                  </div>
                  <div className="session-history-status">
                    <span
                      className={`session-history-status-badge session-history-status-${session.status}`}
                    >
                      {session.status}
                    </span>
                  </div>
                  <button
                    className="session-history-restore"
                    onClick={() => handleRestoreSession(session)}
                    disabled={isLoading}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionHistory;
