import React, { useMemo } from 'react';
import { useAppSelector } from '../../store';
import {
  calculateConversationAnalytics,
  getMessagesPerDayForChart,
  getProviderUsageForChart,
} from '../../utils/conversationAnalytics';

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

const ChartBarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" {...props}>
    <rect x="3" y="8" width="4" height="13" rx="1" />
    <rect x="10" y="3" width="4" height="18" rx="1" />
    <rect x="17" y="11" width="4" height="10" rx="1" />
  </svg>
);

const SparklesIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.3} stroke="currentColor" {...props}>
    <path
      d="M12 2.75 13.35 7a1 1 0 0 0 .65.65L18.25 9 14 10.35a1 1 0 0 0-.65.65L12 15.25 10.65 11a1 1 0 0 0-.65-.65L5.75 9 10 7.65a1 1 0 0 0 .65-.65z"
      strokeLinejoin="round"
    />
    <path d="M6.5 16.5 7 18l1.5.5L7 19l-.5 1.5L6 19l-1.5-.5L6 18z" />
    <path d="M17.5 16l.5 1.5L19.5 18l-1.5.5-.5 1.5-.5-1.5L15.5 18l1.5-.5z" />
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

const TokenIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.6} stroke="currentColor" {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v12" strokeLinecap="round" />
    <path d="M15 9h-4.5a1.5 1.5 0 0 0 0 3h3a1.5 1.5 0 0 1 0 3H9" strokeLinecap="round" />
  </svg>
);

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  color?: 'primary' | 'success' | 'warning' | 'info';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, subtitle, color = 'primary' }) => {
  const colorClasses = {
    primary: 'bg-primary-50 text-primary-600 dark:bg-primary-500/20 dark:text-primary-300',
    success: 'bg-green-50 text-green-600 dark:bg-green-500/20 dark:text-green-300',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300',
    info: 'bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
        </div>
        <div className={cn('rounded-lg p-2', colorClasses[color])}>{icon}</div>
      </div>
    </div>
  );
};

interface MessagesPerDayChartProps {
  data: Array<{ date: string; count: number }>;
}

const MessagesPerDayChart: React.FC<MessagesPerDayChartProps> = ({ data }) => {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <ChartBarIcon className="h-4 w-4 text-primary-500" />
        Messages Per Day (Last 7 Days)
      </h3>
      <div className="space-y-3">
        {data.map((item) => {
          const date = new Date(item.date);
          const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;

          return (
            <div key={item.date} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">{dateLabel}</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {item.count} message{item.count !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      {data.every((d) => d.count === 0) && (
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
          No messages in the last 7 days
        </p>
      )}
    </div>
  );
};

interface ProviderUsageChartProps {
  data: Array<{ provider: string; count: number; percentage: number }>;
}

const ProviderUsageChart: React.FC<ProviderUsageChartProps> = ({ data }) => {
  const providerColors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-green-500',
    'bg-amber-500',
    'bg-red-500',
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <SparklesIcon className="h-4 w-4 text-primary-500" />
        AI Provider Usage
      </h3>
      {data.length > 0 ? (
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={item.provider} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'h-3 w-3 rounded-full',
                      providerColors[index % providerColors.length]
                    )}
                  />
                  <span className="font-medium text-gray-900 dark:text-white">{item.provider}</span>
                </div>
                <span className="text-gray-600 dark:text-gray-400">
                  {item.percentage.toFixed(1)}% ({item.count})
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    providerColors[index % providerColors.length]
                  )}
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
          No provider data available
        </p>
      )}
    </div>
  );
};

interface ConversationAnalyticsDashboardProps {
  className?: string;
}

const ConversationAnalyticsDashboard: React.FC<ConversationAnalyticsDashboardProps> = ({
  className,
}) => {
  const { conversations } = useAppSelector((state) => state.ai);

  const analytics = useMemo(() => calculateConversationAnalytics(conversations), [conversations]);

  const messagesPerDayData = useMemo(
    () => getMessagesPerDayForChart(analytics.messagesPerDay, 7),
    [analytics.messagesPerDay]
  );

  const providerUsageData = useMemo(
    () => getProviderUsageForChart(analytics.providerUsageStats),
    [analytics.providerUsageStats]
  );

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Conversation Analytics</h2>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Conversations"
          value={analytics.totalConversations}
          icon={<MessageIcon className="h-5 w-5" />}
          color="primary"
        />
        <StatCard
          title="Total Messages"
          value={analytics.totalMessages}
          icon={<MessageIcon className="h-5 w-5" />}
          color="success"
        />
        <StatCard
          title="Average Messages"
          value={analytics.averageMessagesPerConversation.toFixed(1)}
          subtitle="per conversation"
          icon={<ChartBarIcon className="h-5 w-5" />}
          color="info"
        />
        <StatCard
          title="Total Tokens"
          value={analytics.totalTokens.toLocaleString()}
          subtitle={analytics.mostUsedProvider ? `Most used: ${analytics.mostUsedProvider}` : ''}
          icon={<TokenIcon className="h-5 w-5" />}
          color="warning"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MessagesPerDayChart data={messagesPerDayData} />
        <ProviderUsageChart data={providerUsageData} />
      </div>

      {/* Empty State */}
      {analytics.totalConversations === 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <SparklesIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
            No conversations yet
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Start a new conversation to see your analytics
          </p>
        </div>
      )}
    </div>
  );
};

export default ConversationAnalyticsDashboard;
