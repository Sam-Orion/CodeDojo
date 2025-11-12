import React, { useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { createTerminalSession, setActiveSession } from '../../store/slices/terminalSlice';
import { addToast } from '../../store/slices/toastSlice';
import TerminalManager from './TerminalManager';
import WebSocketManager from '../../utils/websocketManager';
import './terminal.css';

interface TerminalPanelProps {
  wsManager?: WebSocketManager;
  defaultMode?: 'local' | 'cloud' | 'auto';
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({ wsManager, defaultMode = 'auto' }) => {
  const dispatch = useAppDispatch();
  const { sessions, activeSession, isLoading, supportedLanguages } = useAppSelector(
    (state) => state.terminal
  );
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  const handleCreateSession = useCallback(
    async (language: string) => {
      try {
        await dispatch(
          createTerminalSession({
            language,
            mode: defaultMode,
          })
        ).unwrap();

        dispatch(
          addToast({
            message: `Terminal session created: ${language}`,
            type: 'success',
          })
        );
        setShowLanguageSelector(false);
      } catch (error) {
        dispatch(
          addToast({
            message: `Failed to create terminal: ${error}`,
            type: 'error',
          })
        );
      }
    },
    [dispatch, defaultMode]
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

  return (
    <div className="terminal-panel">
      {/* Terminal Tabs */}
      <div className="terminal-tabs">
        <div className="terminal-tabs-list">
          {sessions.map((session) => (
            <button
              key={session.id}
              className={`terminal-tab ${activeSession?.id === session.id ? 'terminal-tab-active' : ''}`}
              onClick={() => handleSessionTabClick(session.id)}
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
              <span className="terminal-tab-label">{session.language}</span>
              <span
                className={`terminal-tab-status terminal-tab-status-${session.status}`}
                title={session.status}
              />
            </button>
          ))}
        </div>

        {/* New Terminal Button */}
        <div className="terminal-tabs-actions">
          <button
            className="terminal-tab-new"
            onClick={() => setShowLanguageSelector(!showLanguageSelector)}
            title="New terminal"
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
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Language Selector Dropdown */}
      {showLanguageSelector && (
        <div className="terminal-language-selector">
          <div className="terminal-language-selector-header">
            <h4>Select Language</h4>
            <button
              className="terminal-language-selector-close"
              onClick={() => setShowLanguageSelector(false)}
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="terminal-language-selector-list">
            {(supportedLanguages.length > 0
              ? supportedLanguages
              : ['bash', 'python', 'javascript', 'typescript', 'java', 'go', 'rust', 'ruby']
            ).map((language) => (
              <button
                key={language}
                className="terminal-language-option"
                onClick={() => handleCreateSession(language)}
                disabled={isLoading}
              >
                <span className="terminal-language-option-name">{language}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
        ) : (
          <TerminalManager wsManager={wsManager} />
        )}
      </div>
    </div>
  );
};

export default TerminalPanel;
