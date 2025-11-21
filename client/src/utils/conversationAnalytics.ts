import { AIConversation } from '../types';

export interface ConversationMetadata {
  messageCount: number;
  createdAt: string;
  lastModified: string;
  providersUsed: string[];
  duration: number; // in milliseconds
  tokenCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
}

export interface ConversationAnalytics {
  totalConversations: number;
  totalMessages: number;
  totalTokens: number;
  averageMessagesPerConversation: number;
  mostUsedProvider: string | null;
  providerUsageStats: Record<string, number>;
  messagesPerDay: Record<string, number>;
  conversationMetadata: Map<string, ConversationMetadata>;
}

export const getConversationMetadata = (conversation: AIConversation): ConversationMetadata => {
  const messages = conversation.messages || [];
  const messageCount = messages.length;
  const userMessages = messages.filter((m) => m.role === 'user');
  const assistantMessages = messages.filter((m) => m.role === 'assistant');

  // Get unique providers used
  const providersUsed = Array.from(
    new Set(
      assistantMessages
        .map((m) => m.model)
        .filter((model): model is string => model !== undefined && model !== null)
    )
  );

  // Calculate duration
  const timestamps = messages
    .map((m) => m.timestamp)
    .filter((t): t is number => t !== undefined && t !== null);
  const duration = timestamps.length > 1 ? Math.max(...timestamps) - Math.min(...timestamps) : 0;

  // Calculate total tokens
  const tokenCount = messages.reduce((sum, m) => sum + (m.tokenCount || 0), 0);

  return {
    messageCount,
    createdAt: conversation.createdAt,
    lastModified: conversation.updatedAt,
    providersUsed,
    duration,
    tokenCount,
    userMessageCount: userMessages.length,
    assistantMessageCount: assistantMessages.length,
  };
};

export const calculateConversationAnalytics = (
  conversations: AIConversation[]
): ConversationAnalytics => {
  const totalConversations = conversations.length;
  let totalMessages = 0;
  let totalTokens = 0;
  const providerUsageStats: Record<string, number> = {};
  const messagesPerDay: Record<string, number> = {};
  const conversationMetadata = new Map<string, ConversationMetadata>();

  conversations.forEach((conversation) => {
    const metadata = getConversationMetadata(conversation);
    conversationMetadata.set(conversation.id, metadata);

    totalMessages += metadata.messageCount;
    totalTokens += metadata.tokenCount;

    // Count provider usage
    metadata.providersUsed.forEach((provider) => {
      providerUsageStats[provider] = (providerUsageStats[provider] || 0) + 1;
    });

    // Count messages per day
    conversation.messages.forEach((message) => {
      if (message.timestamp) {
        const date = new Date(message.timestamp);
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        messagesPerDay[dateKey] = (messagesPerDay[dateKey] || 0) + 1;
      }
    });
  });

  // Find most used provider
  let mostUsedProvider: string | null = null;
  let maxUsage = 0;
  Object.entries(providerUsageStats).forEach(([provider, count]) => {
    if (count > maxUsage) {
      maxUsage = count;
      mostUsedProvider = provider;
    }
  });

  const averageMessagesPerConversation =
    totalConversations > 0 ? totalMessages / totalConversations : 0;

  return {
    totalConversations,
    totalMessages,
    totalTokens,
    averageMessagesPerConversation,
    mostUsedProvider,
    providerUsageStats,
    messagesPerDay,
    conversationMetadata,
  };
};

export const formatDuration = (durationMs: number): string => {
  if (durationMs === 0) return 'Just started';

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

export const getMessagesPerDayForChart = (
  messagesPerDay: Record<string, number>,
  days: number = 7
): Array<{ date: string; count: number }> => {
  const result: Array<{ date: string; count: number }> = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    result.push({
      date: dateKey,
      count: messagesPerDay[dateKey] || 0,
    });
  }

  return result;
};

export const getProviderUsageForChart = (
  providerUsageStats: Record<string, number>
): Array<{ provider: string; count: number; percentage: number }> => {
  const total = Object.values(providerUsageStats).reduce((sum, count) => sum + count, 0);

  return Object.entries(providerUsageStats)
    .map(([provider, count]) => ({
      provider,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
};
