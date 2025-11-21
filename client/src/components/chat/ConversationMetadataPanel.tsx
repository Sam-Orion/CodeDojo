import React, { useMemo } from 'react';
import type { AIConversation } from '../../types';
import { formatDuration, getConversationMetadata } from '../../utils/conversationAnalytics';

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const CalendarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M8 2v4" strokeLinecap="round" />
    <path d="M16 2v4" strokeLinecap="round" />
    <path d="M3 10h18" />
  </svg>
);

const ClockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l3 3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const MessageIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" {...props}>
    <path
      d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
    {children}
  </span>
);

interface MetadataItemProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

const MetadataItem: React.FC<MetadataItemProps> = ({ label, value, icon }) => (
  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {icon}
      {label}
    </div>
    <div className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{value}</div>
  </div>
);

interface ConversationMetadataPanelProps {
  conversation: AIConversation | null;
  className?: string;
}

const formatDateTime = (value?: string) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

const ConversationMetadataPanel: React.FC<ConversationMetadataPanelProps> = ({
  conversation,
  className,
}) => {
  const metadata = useMemo(
    () => (conversation ? getConversationMetadata(conversation) : null),
    [conversation]
  );

  if (!conversation || !metadata) {
    return (
      <div
        className={cn('rounded-xl border border-dashed border-gray-200 p-4 text-center', className)}
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select a conversation to view metadata
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-gray-100 bg-gradient-to-br from-white via-white to-gray-50 p-4 shadow-sm dark:border-gray-800 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900',
        className
      )}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetadataItem
          label="Total Messages"
          value={metadata.messageCount || 'No messages yet'}
          icon={<MessageIcon className="h-3.5 w-3.5 text-primary-500" />}
        />
        <MetadataItem
          label="Conversation Duration"
          value={metadata.messageCount > 1 ? formatDuration(metadata.duration) : 'Not enough data'}
          icon={<ClockIcon className="h-3.5 w-3.5 text-amber-500" />}
        />
        <MetadataItem
          label="Tokens Used"
          value={metadata.tokenCount > 0 ? metadata.tokenCount.toLocaleString() : 'Not tracked'}
          icon={<MessageIcon className="h-3.5 w-3.5 text-green-500" />}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <MetadataItem
          label="Created"
          value={formatDateTime(metadata.createdAt)}
          icon={<CalendarIcon className="h-3.5 w-3.5 text-blue-500" />}
        />
        <MetadataItem
          label="Last Modified"
          value={formatDateTime(metadata.lastModified)}
          icon={<CalendarIcon className="h-3.5 w-3.5 text-purple-500" />}
        />
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          AI Providers Used
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {metadata.providersUsed.length > 0 ? (
            metadata.providersUsed.map((provider) => <Chip key={provider}>{provider}</Chip>)
          ) : (
            <span className="text-sm text-gray-500 dark:text-gray-400">No provider data yet</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationMetadataPanel;
