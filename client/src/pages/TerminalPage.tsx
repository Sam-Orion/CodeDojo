import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchTerminalCapabilities } from '../store/slices/terminalSlice';
import { TerminalPanel } from '../components/terminal';
import Loader from '../components/ui/Loader';
import WebSocketManager from '../utils/websocketManager';

const TerminalPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { isLoading, error, supportedLanguages } = useAppSelector((state) => state.terminal);
  const [wsManager] = useState(() => new WebSocketManager());

  useEffect(() => {
    dispatch(fetchTerminalCapabilities());

    wsManager
      .connect()
      .then(() => {
        console.log('WebSocket connected for terminal');
      })
      .catch((error) => {
        console.error('Failed to connect WebSocket:', error);
      });

    return () => {
      wsManager.disconnect();
    };
  }, [dispatch, wsManager]);

  if (isLoading && supportedLanguages.length === 0) {
    return (
      <div className="flex flex-col h-full gap-4 p-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Terminal</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Interactive terminal with multi-language support
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader message="Loading terminal capabilities..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full gap-4 p-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Terminal</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Interactive terminal with multi-language support
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-auto mb-4 text-red-500"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Failed to Load
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 p-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Terminal</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Interactive terminal with support for {supportedLanguages.length || 8}+ languages
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <TerminalPanel wsManager={wsManager} defaultLanguage="bash" defaultMode="auto" />
      </div>

      {/* Terminal Info Panel */}
      <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Terminal Features
        </h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <li>
            ✓ Multi-language support (Bash, Python, JavaScript, TypeScript, Java, Go, Rust, Ruby)
          </li>
          <li>✓ Real-time output streaming via WebSocket</li>
          <li>✓ Terminal resize and reflow support</li>
          <li>✓ Copy to clipboard functionality</li>
          <li>✓ Dark theme with syntax highlighting</li>
          <li>✓ Multiple terminal sessions with tabs</li>
          <li>✓ Maximize/minimize toggle</li>
          <li>✓ Auto/Local/Cloud execution modes</li>
        </ul>
      </div>
    </div>
  );
};

export default TerminalPage;
