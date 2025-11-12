import React, { useState, useRef, useCallback, useMemo } from 'react';
import commandHistory from '../../utils/commandHistory';
import commandValidator from '../../utils/commandValidator';

type ExecutionMode = 'local' | 'cloud' | 'auto';

interface TerminalInputProps {
  onSubmit: (command: string, mode: ExecutionMode) => void;
  isExecuting: boolean;
  isTimeout: boolean;
  onAbort?: () => void;
  language?: string;
}

interface Suggestion {
  text: string;
  description?: string;
}

const COMMON_COMMANDS = {
  bash: [
    { text: 'ls', description: 'List files' },
    { text: 'pwd', description: 'Print working directory' },
    { text: 'cd', description: 'Change directory' },
    { text: 'mkdir', description: 'Create directory' },
    { text: 'cat', description: 'Display file content' },
    { text: 'grep', description: 'Search text' },
    { text: 'find', description: 'Find files' },
    { text: 'echo', description: 'Print text' },
  ],
  python: [
    { text: 'print()', description: 'Print statement' },
    { text: 'import', description: 'Import module' },
    { text: 'def', description: 'Define function' },
    { text: 'class', description: 'Define class' },
    { text: 'for', description: 'For loop' },
    { text: 'if', description: 'If statement' },
    { text: 'len()', description: 'Get length' },
    { text: 'range()', description: 'Range iterator' },
  ],
  javascript: [
    { text: 'console.log()', description: 'Log output' },
    { text: 'const', description: 'Declare constant' },
    { text: 'let', description: 'Declare variable' },
    { text: 'function', description: 'Define function' },
    { text: 'return', description: 'Return value' },
    { text: 'async', description: 'Async function' },
    { text: 'await', description: 'Await promise' },
    { text: 'class', description: 'Define class' },
  ],
};

const TerminalInput: React.FC<TerminalInputProps> = ({
  onSubmit,
  isExecuting,
  isTimeout,
  onAbort,
  language = 'bash',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('auto');
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    if (!input.trim() || input.length < 2) return [];

    const langKey = language.toLowerCase() as keyof typeof COMMON_COMMANDS;
    const baseSuggestions = COMMON_COMMANDS[langKey] || COMMON_COMMANDS.bash;

    const filtered = baseSuggestions.filter((cmd) =>
      cmd.text.toLowerCase().startsWith(input.toLowerCase())
    );

    return filtered.length > 0 ? filtered : [];
  }, [input, language]);

  const showSuggestions = suggestions.length > 0 && input.length > 0;

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    setInput(value);
    setValidationError(null);
    setSelectedSuggestionIndex(0);
    commandHistory.resetIndex();
  }, []);

  const handleSubmit = useCallback(() => {
    if (!input.trim() || isExecuting) return;

    const validation = commandValidator.validate(input);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid command');
      return;
    }

    if (validation.warnings && validation.warnings.length > 0) {
      console.warn('Command warnings:', validation.warnings);
    }

    commandHistory.add(input, language);
    onSubmit(input, executionMode);
    setInput('');
    setValidationError(null);
    inputRef.current?.focus();
  }, [input, isExecuting, language, executionMode, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (isExecuting && e.key === 'Escape') {
        onAbort?.();
        return;
      }

      if (showSuggestions) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedSuggestionIndex((prev) => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedSuggestionIndex(
            (prev) => (prev - 1 + suggestions.length) % suggestions.length
          );
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const suggestion = suggestions[selectedSuggestionIndex];
          setInput(suggestion.text);
          setShowSuggestions(false);
        } else if (e.key === 'Escape') {
          setShowSuggestions(false);
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = commandHistory.getPrevious();
        if (prev) setInput(prev);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = commandHistory.getNext();
        setInput(next || '');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [isExecuting, onAbort, showSuggestions, suggestions, selectedSuggestionIndex, handleSubmit]
  );

  const handleSuggestionClick = useCallback((suggestion: Suggestion) => {
    setInput(suggestion.text);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  return (
    <div className="terminal-input-container">
      {isTimeout && (
        <div className="terminal-timeout-warning">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
          </svg>
          <span>Command execution timeout warning</span>
          {onAbort && (
            <button className="terminal-abort-warning-button" onClick={onAbort}>
              Abort
            </button>
          )}
        </div>
      )}

      <div className="terminal-input-wrapper">
        <div className="terminal-input-controls">
          <div className="terminal-input-field-container">
            <input
              ref={inputRef}
              type="text"
              className={`terminal-input-field ${validationError ? 'terminal-input-error' : ''} ${
                isExecuting ? 'terminal-input-disabled' : ''
              }`}
              placeholder="Enter command..."
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isExecuting}
              autoComplete="off"
            />

            {showSuggestions && suggestions.length > 0 && (
              <div className="terminal-suggestions">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.text}-${index}`}
                    className={`terminal-suggestion-item ${
                      index === selectedSuggestionIndex ? 'terminal-suggestion-active' : ''
                    }`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    type="button"
                  >
                    <span className="terminal-suggestion-text">{suggestion.text}</span>
                    {suggestion.description && (
                      <span className="terminal-suggestion-desc">{suggestion.description}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {validationError && (
              <div className="terminal-input-validation-error">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {validationError}
              </div>
            )}
          </div>

          <div className="terminal-input-mode-selector">
            <select
              className="terminal-execution-mode"
              value={executionMode}
              onChange={(e) => setExecutionMode(e.currentTarget.value as ExecutionMode)}
              disabled={isExecuting}
            >
              <option value="auto">Auto</option>
              <option value="local">Local</option>
              <option value="cloud">Cloud</option>
            </select>
          </div>

          {isExecuting ? (
            <button
              className="terminal-input-abort-button"
              onClick={onAbort}
              title="Abort execution (Esc)"
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
              Stop
            </button>
          ) : (
            <button
              className="terminal-input-submit-button"
              onClick={handleSubmit}
              disabled={!input.trim() || isExecuting}
              title="Execute command (Enter)"
              type="button"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Execute
            </button>
          )}
        </div>
      </div>

      {/* History info on focus */}
      {input === '' && !isExecuting && (
        <div className="terminal-input-help">
          <span>Use ↑↓ for history</span>
          <span>Type to see suggestions</span>
        </div>
      )}
    </div>
  );
};

export default TerminalInput;
