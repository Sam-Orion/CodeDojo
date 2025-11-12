import React from 'react';

interface TerminalToolbarProps {
  title: string;
  sessionId: string;
  isMaximized: boolean;
  onClear: () => void;
  onClose: () => void;
  onToggleMaximize: () => void;
  onCopy: () => void;
}

const TerminalToolbar: React.FC<TerminalToolbarProps> = ({
  title,
  sessionId,
  isMaximized,
  onClear,
  onClose,
  onToggleMaximize,
  onCopy,
}) => {
  return (
    <div className="terminal-toolbar">
      <div className="terminal-toolbar-left">
        <span className="terminal-title">{title}</span>
        <span className="terminal-session-id">({sessionId.substring(0, 8)})</span>
      </div>
      <div className="terminal-toolbar-right">
        <button
          className="terminal-toolbar-button"
          onClick={onCopy}
          title="Copy output to clipboard"
          aria-label="Copy output"
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
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <button
          className="terminal-toolbar-button"
          onClick={onClear}
          title="Clear terminal output"
          aria-label="Clear output"
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
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
        <button
          className="terminal-toolbar-button"
          onClick={onToggleMaximize}
          title={isMaximized ? 'Minimize terminal' : 'Maximize terminal'}
          aria-label={isMaximized ? 'Minimize' : 'Maximize'}
        >
          {isMaximized ? (
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
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          ) : (
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
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          )}
        </button>
        <button
          className="terminal-toolbar-button terminal-toolbar-button-danger"
          onClick={onClose}
          title="Close terminal session"
          aria-label="Close terminal"
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
    </div>
  );
};

export default TerminalToolbar;
