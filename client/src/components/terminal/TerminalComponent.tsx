import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { TerminalSession } from '../../types';
import { useAppDispatch } from '../../store';
import { terminateTerminalSession } from '../../store/slices/terminalSlice';
import { addToast } from '../../store/slices/toastSlice';
import TerminalToolbar from './TerminalToolbar';
import TerminalInput from './TerminalInput';
import Loader from '../ui/Loader';
import WebSocketManager from '../../utils/websocketManager';
import { useCommandExecution } from '../../hooks/useCommandExecution';
import './terminal.css';

interface TerminalComponentProps {
  session: TerminalSession;
  onInput?: (input: string) => void;
  onResize?: (cols: number, rows: number) => void;
  isConnecting?: boolean;
  connectionError?: string | null;
  wsManager?: WebSocketManager;
}

const TerminalComponent: React.FC<TerminalComponentProps> = ({
  session,
  onInput,
  onResize,
  isConnecting = false,
  connectionError = null,
  wsManager = new WebSocketManager(),
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const outputIndexRef = useRef(0);
  const [isMaximized, setIsMaximized] = useState(false);
  const dispatch = useAppDispatch();

  const { executionState, executeCommand, abortExecution } = useCommandExecution(wsManager, 30000);

  useEffect(() => {
    if (!terminalRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'SFMono-Regular, Consolas, Liberation Mono, Menlo, Courier, monospace',
      theme: {
        background: '#1e293b',
        foreground: '#f1f5f9',
        cursor: '#3b82f6',
        cursorAccent: '#1e293b',
        selectionBackground: '#3b82f680',
        black: '#1e293b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f1f5f9',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      scrollback: 1000,
      convertEol: true,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    if (onResize) {
      onResize(terminal.cols, terminal.rows);
    }

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    outputIndexRef.current = 0;

    const dataDisposable = terminal.onData((data) => {
      if (session.status === 'running') {
        onInput?.(data);
      }
    });

    const handleResize = () => {
      fitAddon.fit();
      if (onResize && xtermRef.current) {
        onResize(xtermRef.current.cols, xtermRef.current.rows);
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalRef.current);
    window.addEventListener('resize', handleResize);

    terminal.writeln(`\x1b[1;32m✓\x1b[0m Terminal session created: ${session.language}`);
    terminal.writeln(`\x1b[90mSession ID: ${session.id}\x1b[0m`);
    terminal.writeln(`\x1b[90mMode: ${session.mode}\x1b[0m`);
    terminal.writeln('');

    if (session.output.length > 0) {
      terminal.write(session.output.join(''));
      outputIndexRef.current = session.output.length;
    }

    return () => {
      dataDisposable.dispose();
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      outputIndexRef.current = 0;
    };
  }, [
    session.id,
    session.language,
    session.mode,
    session.output,
    session.status,
    onInput,
    onResize,
  ]);

  useEffect(() => {
    if (!xtermRef.current) return;
    if (session.output.length <= outputIndexRef.current) return;

    const newOutput = session.output.slice(outputIndexRef.current).join('');
    xtermRef.current.write(newOutput);
    outputIndexRef.current = session.output.length;
  }, [session.output]);

  useEffect(() => {
    if (!xtermRef.current) return;

    if (session.status === 'stopped') {
      xtermRef.current.writeln('');
      xtermRef.current.writeln('\x1b[1;33m⚠\x1b[0m Terminal session ended');
    } else if (session.status === 'error') {
      xtermRef.current.writeln('');
      xtermRef.current.writeln('\x1b[1;31m✗\x1b[0m Terminal session error');
    }
  }, [session.status]);

  const handleClear = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.clear();
      outputIndexRef.current = 0;
      dispatch(
        addToast({
          message: 'Terminal cleared',
          type: 'success',
        })
      );
    }
  }, [dispatch]);

  const handleCopy = useCallback(() => {
    if (!xtermRef.current) {
      return;
    }

    const selection = xtermRef.current.getSelection();
    const textToCopy = selection || session.output.join('');

    if (!textToCopy) {
      dispatch(
        addToast({
          message: 'Nothing to copy',
          type: 'warning',
        })
      );
      return;
    }

    if (!navigator.clipboard) {
      dispatch(
        addToast({
          message: 'Clipboard API is not available in this browser',
          type: 'error',
        })
      );
      return;
    }

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        dispatch(
          addToast({
            message: selection ? 'Selection copied to clipboard' : 'Terminal output copied',
            type: 'success',
          })
        );
      })
      .catch(() => {
        dispatch(
          addToast({
            message: 'Failed to copy to clipboard',
            type: 'error',
          })
        );
      });
  }, [session.output, dispatch]);

  const handleClose = useCallback(async () => {
    try {
      await dispatch(terminateTerminalSession(session.id)).unwrap();
      dispatch(
        addToast({
          message: 'Terminal session closed',
          type: 'success',
        })
      );
    } catch (error) {
      dispatch(
        addToast({
          message: `Failed to close terminal: ${error instanceof Error ? error.message : error}`,
          type: 'error',
        })
      );
    }
  }, [session.id, dispatch]);

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev);
    window.setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit();
      }
    }, 100);
  }, []);

  const handleCommandSubmit = useCallback(
    (command: string) => {
      executeCommand(session.id, command);
    },
    [session.id, executeCommand]
  );

  const handleAbort = useCallback(() => {
    abortExecution(session.id);
  }, [session.id, abortExecution]);

  const containerClass = `terminal-container terminal-with-line-numbers ${
    isMaximized ? 'terminal-maximized' : ''
  }`;

  if (connectionError) {
    return (
      <div className={containerClass}>
        <TerminalToolbar
          title={`${session.language} Terminal`}
          sessionId={session.id}
          isMaximized={isMaximized}
          onClear={handleClear}
          onClose={handleClose}
          onToggleMaximize={handleToggleMaximize}
          onCopy={handleCopy}
        />
        <div className="terminal-error-state">
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
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3>Connection Failed</h3>
          <p>{connectionError}</p>
          <button className="terminal-error-retry" onClick={handleClose}>
            Close Terminal
          </button>
        </div>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className={containerClass}>
        <TerminalToolbar
          title={`${session.language} Terminal`}
          sessionId={session.id}
          isMaximized={isMaximized}
          onClear={handleClear}
          onClose={handleClose}
          onToggleMaximize={handleToggleMaximize}
          onCopy={handleCopy}
        />
        <div className="terminal-loading-state">
          <Loader />
          <p>Connecting to terminal session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <TerminalToolbar
        title={`${session.language} Terminal`}
        sessionId={session.id}
        isMaximized={isMaximized}
        onClear={handleClear}
        onClose={handleClose}
        onToggleMaximize={handleToggleMaximize}
        onCopy={handleCopy}
      />
      <div className="terminal-wrapper">
        <div className="terminal-xterm" ref={terminalRef} />
      </div>
      <TerminalInput
        onSubmit={handleCommandSubmit}
        isExecuting={executionState.isExecuting}
        isTimeout={executionState.isTimeout}
        onAbort={handleAbort}
        language={session.language}
      />
    </div>
  );
};

export default TerminalComponent;
