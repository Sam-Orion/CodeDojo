import React, { KeyboardEvent, useRef, useState, useEffect, type SVGProps } from 'react';
import Button from '../ui/Button';

const SendIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" {...props}>
    <path d="M22 2 11 13" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 2 15 22 11 13 2 9z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ClearIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" {...props}>
    <path d="M18 6 6 18" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m6 6 12 12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface ChatInputProps {
  onSubmit: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  initialValue?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSubmit,
  isLoading = false,
  disabled = false,
  placeholder = 'Type your message... (Shift+Enter for newline)',
  initialValue = '',
}) => {
  const [inputValue, setInputValue] = useState(() => initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleSubmit = () => {
    const trimmedValue = inputValue.trim();
    if (trimmedValue && !isLoading && !disabled) {
      onSubmit(trimmedValue);
      setInputValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleClear = () => {
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const characterCount = inputValue.length;
  const isInputDisabled = isLoading || disabled;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={isInputDisabled}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-primary-400"
          style={{ maxHeight: '200px', overflowY: 'auto' }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {characterCount} character{characterCount === 1 ? '' : 's'}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={isInputDisabled || inputValue.length === 0}
            className="flex items-center gap-1.5"
          >
            <ClearIcon className="h-4 w-4" />
            Clear
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={isInputDisabled || inputValue.trim().length === 0}
            isLoading={isLoading}
            className="flex items-center gap-1.5"
          >
            {!isLoading && <SendIcon className="h-4 w-4" />}
            {isLoading ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
