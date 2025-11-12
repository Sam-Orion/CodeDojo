import React, { useState, useCallback } from 'react';
import { useAppSelector } from '../../store';
import TerminalManager from './TerminalManager';
import WebSocketManager from '../../utils/websocketManager';
import './terminal.css';

interface SplitTerminalProps {
  wsManager?: WebSocketManager;
  onSplitToggle?: () => void;
}

const SplitTerminal: React.FC<SplitTerminalProps> = ({ wsManager, onSplitToggle }) => {
  const { sessions, activeSession } = useAppSelector((state) => state.terminal);
  const [splitDirection, setSplitDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [isSplit, setIsSplit] = useState(false);

  const handleSplitToggle = useCallback(() => {
    setIsSplit(!isSplit);
    onSplitToggle?.();
  }, [isSplit, onSplitToggle]);

  const handleDirectionChange = useCallback(() => {
    setSplitDirection((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
  }, []);

  if (!isSplit) {
    return (
      <div className="split-terminal-container">
        <div className="split-terminal-controls">
          <button
            className="split-terminal-button"
            onClick={handleSplitToggle}
            title="Split terminal"
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
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="12" y1="3" x2="12" y2="21" />
            </svg>
          </button>
        </div>
        <TerminalManager wsManager={wsManager} />
      </div>
    );
  }

  // Get two sessions for split view
  const firstSession = activeSession || sessions[0];
  const secondSession = sessions.find((s) => s.id !== firstSession?.id) || sessions[1];

  return (
    <div className="split-terminal-container split-terminal-active">
      <div className="split-terminal-controls">
        <button
          className="split-terminal-button"
          onClick={handleSplitToggle}
          title="Unsplit terminal"
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
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          </svg>
        </button>
        <button
          className="split-terminal-button"
          onClick={handleDirectionChange}
          title={`Change to ${splitDirection === 'horizontal' ? 'vertical' : 'horizontal'} split`}
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
            {splitDirection === 'horizontal' ? (
              <>
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            ) : (
              <>
                <line x1="12" y1="3" x2="12" y2="21" />
                <line x1="6" y1="3" x2="6" y2="21" />
                <line x1="18" y1="3" x2="18" y2="21" />
              </>
            )}
          </svg>
        </button>
      </div>

      <div className={`split-terminal-panels split-terminal-${splitDirection}`}>
        <div className="split-terminal-panel">
          {firstSession && <TerminalManager wsManager={wsManager} sessionId={firstSession.id} />}
        </div>
        <div className="split-terminal-divider" />
        <div className="split-terminal-panel">
          {secondSession ? (
            <TerminalManager wsManager={wsManager} sessionId={secondSession.id} />
          ) : (
            <div className="split-terminal-empty">
              <div className="split-terminal-empty-content">
                <svg
                  width="24"
                  height="24"
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
                <p>Create another session to use split view</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SplitTerminal;
