import React, { useCallback, useEffect, useRef, useState, type SVGProps } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  addSystemMessage,
  clearError,
  createConversation,
  fetchConversations,
  removeMessage,
  sendMessage,
  setMessageFeedback,
} from '../../store/slices/aiSlice';
import { useStreamingMessages, useOfflineMessageQueue } from '../../hooks';
import type { AIMessage } from '../../types';
import Button from '../ui/Button';
import MarkdownRenderer from './MarkdownRenderer';
import ChatInput from './ChatInput';
import OfflineQueueIndicator from './OfflineQueueIndicator';

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const formatTimestamp = (timestamp: number) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const CopyIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor" {...props}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15.5A2.5 2.5 0 0 1 2.5 13V5A2.5 2.5 0 0 1 5 2.5h8A2.5 2.5 0 0 1 15.5 5" />
  </svg>
);

const CheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" {...props}>
    <path d="m5 12.5 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const RefreshIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" {...props}>
    <path
      d="M21 12a9 9 0 0 0-9-9 9.003 9.003 0 0 0-8.485 6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M21 4v8h-8" strokeLinecap="round" strokeLinejoin="round" />
    <path
      d="M3 12a9 9 0 0 0 9 9 9.003 9.003 0 0 0 8.485-6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M3 20v-8h8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const TrashIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" {...props}>
    <path d="M4 6h16" strokeLinecap="round" />
    <path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6" />
    <path d="M18 6v12.5A1.5 1.5 0 0 1 16.5 20h-9A1.5 1.5 0 0 1 6 18.5V6" />
    <path d="M10 10v6" strokeLinecap="round" />
    <path d="M14 10v6" strokeLinecap="round" />
  </svg>
);

const ThumbUpIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" {...props}>
    <path
      d="M6 10v10H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6 20h9.5a3.5 3.5 0 0 0 3.444-2.83l1.007-5.03A2.5 2.5 0 0 0 17.5 9H13l.86-3.44A1.5 1.5 0 0 0 12.396 4L9 7.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ThumbDownIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" {...props}>
    <path
      d="M18 14V4h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18 4H8.5a3.5 3.5 0 0 0-3.444 2.83l-1.007 5.03A2.5 2.5 0 0 0 6.5 15H11l-.86 3.44A1.5 1.5 0 0 0 11.604 20L15 16.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SparklesIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.3} stroke="currentColor" {...props}>
    <path
      d="M12 2.75 13.35 7a1 1 0 0 0 .65.65L18.25 9 14 10.35a1 1 0 0 0-.65.65L12 15.25 10.65 11a1 1 0 0 0-.65-.65L5.75 9 10 7.65a1 1 0 0 0 .65-.65z"
      strokeLinejoin="round"
    />
    <path d="M6.5 16.5 7 18l1.5.5L7 19l-.5 1.5L6 19l-1.5-.5L6 18z" />
    <path d="M17.5 16l.5 1.5L19.5 18l-1.5.5-.5 1.5-.5-1.5L15.5 18l1.5-.5z" />
  </svg>
);

const WarningIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} stroke="currentColor" {...props}>
    <path d="M12 8v4" strokeLinecap="round" />
    <path d="M12 16h.01" strokeLinecap="round" />
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0" />
  </svg>
);

const InfoIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" {...props}>
    <path d="M12 8h.01" strokeLinecap="round" />
    <path d="M11 12h1v4h1" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="9" />
  </svg>
);

const SpinnerIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    className={cn('animate-spin', className)}
    {...props}
  >
    <path d="M12 3a9 9 0 1 1-9 9" strokeWidth={2} strokeLinecap="round" opacity={0.25} />
    <path d="M21 12a9 9 0 0 0-9-9" strokeWidth={2} strokeLinecap="round" />
  </svg>
);

const StopIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);

interface MessageActionButtonProps {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  isActive?: boolean;
  disabled?: boolean;
}

const MessageActionButton: React.FC<MessageActionButtonProps> = ({
  label,
  onClick,
  icon,
  isActive = false,
  disabled = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-full border text-gray-500 transition hover:scale-105 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:text-gray-300 dark:hover:text-gray-100',
        isActive &&
          'border-primary-500 bg-primary-50 text-primary-600 dark:border-primary-400 dark:bg-primary-500/20 dark:text-primary-200',
        disabled && 'cursor-not-allowed opacity-50 hover:scale-100'
      )}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      {icon}
    </button>
  );
};

interface LoadingIndicatorProps {
  isStreaming?: boolean;
  tokenCount?: number;
  onStop?: () => void;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  isStreaming = false,
  tokenCount = 0,
  onStop,
}) => (
  <div className="flex items-center gap-3 rounded-full bg-gray-100 px-4 py-2 text-sm text-gray-600 shadow-sm dark:bg-gray-800/60 dark:text-gray-300">
    <span className="flex h-2 w-2 animate-ping rounded-full bg-primary-500" />
    {isStreaming ? (
      <>
        <span>Streaming response{tokenCount > 0 ? ` (${tokenCount} tokens)` : '...'}</span>
        {onStop && (
          <button
            onClick={onStop}
            className="ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30"
            type="button"
          >
            <StopIcon className="h-3 w-3" />
            Stop
          </button>
        )}
      </>
    ) : (
      <span>Waiting for AI response...</span>
    )}
  </div>
);

const EmptyState = () => (
  <div className="pointer-events-none flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
    <SparklesIcon className="h-8 w-8 text-primary-500" />
    <p className="max-w-xs text-balance">
      Start collaborating with the AI assistant. Your conversation history will appear here.
    </p>
  </div>
);

interface ChatInterfaceProps {
  initialMessage?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ initialMessage }) => {
  const dispatch = useAppDispatch();
  const { activeConversation, conversations, isLoading, isSubmitting, error } = useAppSelector(
    (state) => state.ai
  );
  const messages = activeConversation?.messages ?? [];

  const { startStream, stopStream, isStreaming, tokenCount } = useStreamingMessages();

  const {
    isOnline,
    queueSize,
    isRetrying,
    retryProgress,
    queueFull,
    maxQueueSize,
    queueMessage,
    clearQueue,
    retryNow,
  } = useOfflineMessageQueue();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasFetchedRef = useRef(false);
  const creatingConversationRef = useRef(false);

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [regeneratingMessageId, setRegeneratingMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!hasFetchedRef.current) {
      hasFetchedRef.current = true;
      dispatch(fetchConversations());
    }
  }, [dispatch]);

  useEffect(() => {
    if (
      !isLoading &&
      conversations.length === 0 &&
      !activeConversation &&
      !creatingConversationRef.current
    ) {
      creatingConversationRef.current = true;
      dispatch(createConversation())
        .unwrap()
        .catch(() => {
          // Errors are handled by the slice; no-op here.
        })
        .finally(() => {
          creatingConversationRef.current = false;
        });
    }
  }, [isLoading, conversations.length, activeConversation, dispatch]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages.length, isLoading, isSubmitting, isStreaming, tokenCount]);

  useEffect(() => {
    if (copiedMessageId) {
      const timeout = setTimeout(() => setCopiedMessageId(null), 1600);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [copiedMessageId]);

  const handleCopy = useCallback(
    async (message: AIMessage) => {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        if (activeConversation) {
          dispatch(
            addSystemMessage({
              conversationId: activeConversation.id,
              content:
                'Copy to clipboard is not supported in this environment. Try selecting the text manually.',
              status: 'info',
            })
          );
        }
        return;
      }

      try {
        await navigator.clipboard.writeText(message.content);
        setCopiedMessageId(message.id);
      } catch (copyError) {
        if (activeConversation) {
          dispatch(
            addSystemMessage({
              conversationId: activeConversation.id,
              content: 'We could not copy the message. Please try again or copy the text manually.',
              status: 'error',
            })
          );
        }
        console.error('Failed to copy message:', copyError);
      }
    },
    [activeConversation, dispatch]
  );

  const handleDelete = useCallback(
    (message: AIMessage) => {
      if (!activeConversation) return;
      dispatch(removeMessage({ conversationId: activeConversation.id, messageId: message.id }));
    },
    [activeConversation, dispatch]
  );

  const handleFeedback = useCallback(
    (message: AIMessage, feedback: 'up' | 'down') => {
      if (!activeConversation) return;
      const nextFeedback = message.feedback === feedback ? null : feedback;
      dispatch(
        setMessageFeedback({
          conversationId: activeConversation.id,
          messageId: message.id,
          feedback: nextFeedback,
        })
      );
    },
    [activeConversation, dispatch]
  );

  const handleRegenerate = useCallback(
    (message: AIMessage) => {
      if (!activeConversation) return;
      const { id: conversationId, messages: conversationMessages } = activeConversation;
      const currentIndex = conversationMessages.findIndex((m: AIMessage) => m.id === message.id);
      if (currentIndex === -1) {
        return;
      }

      const priorUserPrompt = [...conversationMessages]
        .slice(0, currentIndex)
        .reverse()
        .find((m) => m.role === 'user');

      if (!priorUserPrompt) {
        dispatch(
          addSystemMessage({
            conversationId,
            content:
              'Unable to regenerate this response because the original user prompt could not be found. Send a new message to continue.',
            status: 'info',
            suggestions: ['Send a new prompt to the assistant to generate a fresh response.'],
          })
        );
        return;
      }

      setRegeneratingMessageId(message.id);
      dispatch(sendMessage({ conversationId, content: priorUserPrompt.content }))
        .unwrap()
        .catch(() => {
          // Errors are surfaced via the AI slice and displayed as system messages.
        })
        .finally(() => {
          setRegeneratingMessageId((current) => (current === message.id ? null : current));
        });
    },
    [activeConversation, dispatch]
  );

  const handleRetry = useCallback(() => {
    dispatch(fetchConversations());
  }, [dispatch]);

  const handleDismissError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  const getSenderLabel = useCallback((message: AIMessage) => {
    switch (message.role) {
      case 'user':
        return 'You';
      case 'assistant':
        return message.model || 'AI Assistant';
      default:
        return message.status === 'error' ? 'System alert' : 'System';
    }
  }, []);

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!activeConversation || isSubmitting || isStreaming) {
        return;
      }

      // If offline, queue the message
      if (!isOnline) {
        try {
          queueMessage(content);
          return;
        } catch (error) {
          // Show error if queue is full or other queueing issues
          if (activeConversation) {
            dispatch(
              addSystemMessage({
                conversationId: activeConversation.id,
                content: error instanceof Error ? error.message : 'Failed to queue message',
                status: 'error',
              })
            );
          }
          return;
        }
      }

      // If online, use streaming for real-time token updates
      startStream({
        conversationId: activeConversation.id,
        content,
      });
    },
    [activeConversation, isSubmitting, isStreaming, isOnline, dispatch, startStream, queueMessage]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div className="flex flex-col">
          <span className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <SparklesIcon className="h-5 w-5 text-primary-500" />
            AI Assistant
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {activeConversation
              ? 'Chat with context-aware AI assistance.'
              : 'Preparing your conversation...'}
          </span>
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          {messages.length} message{messages.length === 1 ? '' : 's'}
        </div>
      </header>

      <div className="px-4 py-2">
        <OfflineQueueIndicator
          isOnline={isOnline}
          queueSize={queueSize}
          isRetrying={isRetrying}
          retryProgress={retryProgress}
          queueFull={queueFull}
          maxQueueSize={maxQueueSize}
          onRetryNow={retryNow}
          onClearQueue={clearQueue}
        />
      </div>

      {error && (
        <div className="border-b border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <WarningIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500 dark:text-red-300" />
              <div className="space-y-1">
                <p className="font-semibold">Something went wrong</p>
                <p>{error}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  <li>Check your network connection and try again.</li>
                  <li>Retry sending the message or regenerate the response.</li>
                  <li>Contact an administrator if the problem persists.</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={handleRetry}>
                Retry
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismissError}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="flex-1 space-y-6 overflow-y-auto px-4 py-6"
        aria-live="polite"
        aria-busy={isLoading || isStreaming}
      >
        {messages.length === 0 && !isLoading ? (
          <EmptyState />
        ) : (
          messages.map((message: AIMessage) => {
            const isUser = message.role === 'user';
            const isAssistant = message.role === 'assistant';
            const isSystem = message.role === 'system';
            const metadataLabel = getSenderLabel(message);
            const timestamp = formatTimestamp(message.timestamp);
            const isCopied = copiedMessageId === message.id;
            const isRegenerating = regeneratingMessageId === message.id;
            const tokenBadge =
              typeof message.tokenCount === 'number'
                ? `${message.tokenCount.toLocaleString()} token${message.tokenCount === 1 ? '' : 's'}`
                : null;

            const bubbleClasses = cn(
              'w-full rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm transition-all',
              isUser &&
                'border-primary-600 bg-primary-600 text-white shadow-primary-600/20 dark:border-primary-500 dark:bg-primary-500',
              isAssistant &&
                'border-gray-200 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100',
              isSystem &&
                (message.status === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-100'
                  : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100'),
              message.status === 'pending' &&
                'border-dashed border-primary-300 bg-primary-50/60 text-primary-900 dark:border-primary-500/60 dark:bg-primary-500/10 dark:text-primary-100'
            );

            return (
              <div
                key={message.id}
                className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'flex max-w-[92%] flex-col gap-2 md:max-w-[80%]',
                    isUser ? 'items-end text-right' : 'items-start text-left'
                  )}
                >
                  <div
                    className={cn(
                      'flex flex-wrap items-center gap-2 text-xs',
                      isUser
                        ? 'justify-end text-primary-100/90'
                        : 'justify-start text-gray-500 dark:text-gray-400'
                    )}
                  >
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        isUser && 'bg-primary-600/80 text-white',
                        isAssistant &&
                          'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
                        isSystem &&
                          (message.status === 'error'
                            ? 'bg-red-500/20 text-red-900 dark:bg-red-500/30 dark:text-red-100'
                            : 'bg-blue-500/10 text-blue-900 dark:bg-blue-500/20 dark:text-blue-100')
                      )}
                    >
                      {metadataLabel}
                    </span>
                    {timestamp && <span>{timestamp}</span>}
                    {message.model && !isUser && (
                      <span className="rounded-full border border-primary-200/70 px-2 py-0.5 text-[10px] uppercase tracking-wide text-primary-600 dark:border-primary-500/30 dark:text-primary-300">
                        {message.model}
                      </span>
                    )}
                    {tokenBadge && (
                      <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] tracking-wide text-gray-600 dark:border-gray-600 dark:text-gray-300">
                        {tokenBadge}
                      </span>
                    )}
                  </div>

                  <div className={bubbleClasses}>
                    {isAssistant || isSystem ? (
                      <MarkdownRenderer content={message.content} />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-white/95 dark:text-white">
                        {message.content}
                      </p>
                    )}

                    {message.isStreaming && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <SpinnerIcon className="h-3 w-3" />
                        <span>Streaming...</span>
                      </div>
                    )}

                    {isSystem && message.status === 'error' && (
                      <div className="mt-3 flex items-start gap-2 text-sm">
                        <WarningIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500 dark:text-red-300" />
                        <span>An error occurred while generating the response.</span>
                      </div>
                    )}

                    {isSystem && message.status === 'info' && (
                      <div className="mt-3 flex items-start gap-2 text-sm text-blue-900 dark:text-blue-100">
                        <InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>This is a system update for your conversation.</span>
                      </div>
                    )}
                  </div>

                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="w-full rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-left text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                      <p className="font-semibold">Actionable suggestions</p>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {message.suggestions.map((suggestion: string) => (
                          <li key={suggestion}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div
                    className={cn(
                      'flex flex-wrap items-center gap-2 text-xs',
                      isUser
                        ? 'justify-end text-white/80'
                        : 'justify-start text-gray-500 dark:text-gray-400'
                    )}
                  >
                    {isRegenerating && (
                      <span className="flex items-center gap-1 text-primary-600 dark:text-primary-300">
                        <SpinnerIcon className="h-3 w-3" /> Regenerating...
                      </span>
                    )}
                    <div className="flex flex-wrap items-center gap-1">
                      <MessageActionButton
                        label={isCopied ? 'Copied' : 'Copy message'}
                        onClick={() => handleCopy(message)}
                        icon={
                          isCopied ? (
                            <CheckIcon className="h-3.5 w-3.5" />
                          ) : (
                            <CopyIcon className="h-3.5 w-3.5" />
                          )
                        }
                      />

                      {(isAssistant || isSystem) && (
                        <MessageActionButton
                          label="Delete message"
                          onClick={() => handleDelete(message)}
                          icon={<TrashIcon className="h-3.5 w-3.5" />}
                        />
                      )}

                      {isUser && (
                        <MessageActionButton
                          label="Delete message"
                          onClick={() => handleDelete(message)}
                          icon={<TrashIcon className="h-3.5 w-3.5" />}
                        />
                      )}

                      {isAssistant && (
                        <MessageActionButton
                          label="Regenerate response"
                          onClick={() => handleRegenerate(message)}
                          icon={<RefreshIcon className="h-3.5 w-3.5" />}
                          disabled={isLoading}
                        />
                      )}

                      {isAssistant && (
                        <MessageActionButton
                          label="Mark response as helpful"
                          onClick={() => handleFeedback(message, 'up')}
                          icon={<ThumbUpIcon className="h-3.5 w-3.5" />}
                          isActive={message.feedback === 'up'}
                        />
                      )}

                      {isAssistant && (
                        <MessageActionButton
                          label="Mark response as unhelpful"
                          onClick={() => handleFeedback(message, 'down')}
                          icon={<ThumbDownIcon className="h-3.5 w-3.5" />}
                          isActive={message.feedback === 'down'}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {(isLoading || isSubmitting || isStreaming) && (
          <div className="flex justify-start">
            <LoadingIndicator
              isStreaming={isStreaming}
              tokenCount={tokenCount}
              onStop={isStreaming ? stopStream : undefined}
            />
          </div>
        )}
      </div>

      <footer className="border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-950">
        <ChatInput
          key={initialMessage}
          onSubmit={handleSendMessage}
          isLoading={isSubmitting || isStreaming}
          disabled={!activeConversation || isSubmitting || isStreaming || (!isOnline && queueFull)}
          initialValue={initialMessage}
          placeholder={
            !isOnline
              ? queueFull
                ? 'Queue full. Clear queue to send messages...'
                : 'Offline. Messages will be queued...'
              : queueFull
                ? 'Queue full. Clear queue to send more messages...'
                : 'Type your message... (Shift+Enter for newline)'
          }
        />
      </footer>
    </div>
  );
};

export default ChatInterface;
