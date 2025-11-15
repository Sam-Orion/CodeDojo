import React, { type SVGProps } from 'react';
import Button from '../ui/Button';

const WifiIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" {...props}>
    <path d="M5 12.55a11 11 0 0 1 14.08 0" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="20" x2="12.01" y2="20" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WifiOffIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" {...props}>
    <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M16.72 11.06A11 11 0 0 1 5 12.55" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M22 12.55a11 11 0 0 0-3.28-6.49" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="12" y1="20" x2="12.01" y2="20" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ClockIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" {...props}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
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

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

interface OfflineQueueIndicatorProps {
  isOnline: boolean;
  queueSize: number;
  isRetrying: boolean;
  retryProgress?: { current: number; total: number } | null;
  queueFull: boolean;
  maxQueueSize: number;
  onRetryNow?: () => void;
  onClearQueue?: () => void;
}

const OfflineQueueIndicator: React.FC<OfflineQueueIndicatorProps> = ({
  isOnline,
  queueSize,
  isRetrying,
  retryProgress,
  queueFull,
  maxQueueSize,
  onRetryNow,
  onClearQueue,
}) => {
  if (isOnline && queueSize === 0) {
    return null;
  }

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-600 dark:text-red-400';
    if (queueFull) return 'text-orange-600 dark:text-orange-400';
    if (queueSize > 0) return 'text-amber-600 dark:text-amber-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getBgColor = () => {
    if (!isOnline) return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    if (queueFull)
      return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
    if (queueSize > 0)
      return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
    return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm',
        getBgColor()
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn('flex items-center gap-1', getStatusColor())}>
          {isOnline ? (
            queueSize > 0 ? (
              <ClockIcon className="h-4 w-4" />
            ) : (
              <WifiIcon className="h-4 w-4" />
            )
          ) : (
            <WifiOffIcon className="h-4 w-4" />
          )}

          <span className="font-medium">
            {!isOnline
              ? 'Offline'
              : queueSize > 0
                ? `Queued: ${queueSize}/${maxQueueSize}`
                : 'Online'}
          </span>
        </div>

        {queueFull && (
          <span className="text-xs text-orange-600 dark:text-orange-400">Queue full</span>
        )}

        {isRetrying && retryProgress && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Retrying {retryProgress.current}/{retryProgress.total}...
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {isOnline && queueSize > 0 && !isRetrying && onRetryNow && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRetryNow}
            className="h-6 px-2 text-xs"
          >
            <RefreshIcon className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}

        {queueSize > 0 && onClearQueue && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearQueue}
            className="h-6 px-2 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            <TrashIcon className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
};

export default OfflineQueueIndicator;
