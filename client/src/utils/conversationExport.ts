import type { AIConversation, AIMessage } from '../types';

export type ConversationExportFormat = 'json' | 'markdown';

const LARGE_CONVERSATION_THRESHOLD = 250;
const MESSAGE_YIELD_INTERVAL = 100;

type ConversationWithMetadata = AIConversation & {
  metadata?: Record<string, unknown>;
};

const sanitizeFilenameSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

const formatDateTime = (value: string | number | undefined) => {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleString();
};

const yieldToMainThread = () =>
  new Promise<void>((resolve) => {
    if (
      typeof window !== 'undefined' &&
      typeof (window as any).requestIdleCallback === 'function'
    ) {
      (window as any).requestIdleCallback(() => resolve());
    } else {
      setTimeout(() => resolve(), 0);
    }
  });

const maybeYield = async (totalMessages: number, index?: number) => {
  if (totalMessages < LARGE_CONVERSATION_THRESHOLD) {
    return;
  }

  if (typeof index === 'number') {
    if ((index + 1) % MESSAGE_YIELD_INTERVAL === 0) {
      await yieldToMainThread();
    }
    return;
  }

  await yieldToMainThread();
};

const getMessageLabel = (message: AIMessage) => {
  switch (message.role) {
    case 'user':
      return 'You';
    case 'assistant':
      return message.model || 'AI Assistant';
    default:
      return message.status === 'error' ? 'System Alert' : 'System';
  }
};

const ensureContent = (content?: string) =>
  content && content.trim().length > 0 ? content : '_No content provided._';

const formatUserBlock = (label: string, content?: string) => {
  const safeContent = ensureContent(content).split(/\r?\n/);
  return safeContent.map((line, index) => (index === 0 ? `> **${label}:** ${line}` : `> ${line}`));
};

const formatAssistantBlock = (label: string, content?: string) => {
  return [`**${label}:**`, '', ensureContent(content)];
};

const formatSystemBlock = (label: string, content?: string) =>
  `_${label}: ${ensureContent(content)}_`;

const buildMessageMetadataLine = (message: AIMessage) => {
  const metaParts: string[] = [];

  if (message.model) {
    metaParts.push(`Model: ${message.model}`);
  }

  if (typeof message.tokenCount === 'number') {
    metaParts.push(`Tokens: ${message.tokenCount.toLocaleString()}`);
  }

  if (message.status) {
    metaParts.push(`Status: ${message.status}`);
  }

  if (message.feedback) {
    metaParts.push(`Feedback: ${message.feedback}`);
  }

  if (message.errorDetails) {
    metaParts.push(`Error: ${message.errorDetails}`);
  }

  return metaParts.length > 0 ? `_(${metaParts.join(' • ')})_` : null;
};

export const buildConversationFilename = (
  conversation: AIConversation,
  format: ConversationExportFormat
) => {
  const datePart = new Date().toISOString().split('T')[0];
  const base = sanitizeFilenameSegment(conversation.title || 'conversation') || 'conversation';
  const extension = format === 'json' ? 'json' : 'md';

  return `${base}-${datePart}.${extension}`;
};

export const buildConversationJson = async (conversation: AIConversation) => {
  await maybeYield(conversation.messages.length);

  const payload = {
    ...conversation,
    exportedAt: new Date().toISOString(),
    messageCount: conversation.messages.length,
  };

  return JSON.stringify(payload, null, 2);
};

export const buildConversationMarkdown = async (conversation: AIConversation) => {
  const lines: string[] = [];
  const enrichedConversation = conversation as ConversationWithMetadata;
  const metadata =
    enrichedConversation.metadata && Object.keys(enrichedConversation.metadata).length > 0
      ? enrichedConversation.metadata
      : null;

  lines.push('# Conversation Export');
  lines.push('');
  lines.push(`- **Conversation ID:** ${conversation.id}`);
  lines.push(`- **Title:** ${conversation.title || 'Untitled conversation'}`);
  lines.push(`- **Created At:** ${formatDateTime(conversation.createdAt)}`);
  lines.push(`- **Updated At:** ${formatDateTime(conversation.updatedAt)}`);
  lines.push(`- **Messages:** ${conversation.messages.length}`);
  lines.push(`- **Favorite:** ${conversation.isFavorite ? 'Yes' : 'No'}`);
  lines.push(`- **Exported At:** ${formatDateTime(Date.now())}`);

  if (metadata) {
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(metadata, null, 2));
    lines.push('```');
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Messages');
  lines.push('');

  if (conversation.messages.length === 0) {
    lines.push('_No messages in this conversation yet._');
    return lines.join('\n').trimEnd().concat('\n');
  }

  for (let index = 0; index < conversation.messages.length; index += 1) {
    const message = conversation.messages[index];
    if (!message) {
      continue;
    }

    const label = getMessageLabel(message);
    const timestamp = formatDateTime(message.timestamp);
    lines.push(`<!-- ${label} | ${timestamp} -->`);

    if (message.role === 'user') {
      lines.push(...formatUserBlock(label, message.content));
    } else if (message.role === 'assistant') {
      lines.push(...formatAssistantBlock(label, message.content));
    } else {
      lines.push(formatSystemBlock(label, message.content));
    }

    const metaLine = buildMessageMetadataLine(message);
    if (metaLine) {
      lines.push('');
      lines.push(metaLine);
    }

    if (message.suggestions && message.suggestions.length > 0) {
      lines.push('');
      lines.push('_Suggestions:_');
      message.suggestions.forEach((suggestion) => {
        lines.push(`- ${suggestion}`);
      });
    }

    if (index < conversation.messages.length - 1) {
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    await maybeYield(conversation.messages.length, index);
  }

  return lines.join('\n').trimEnd().concat('\n');
};

export const triggerFileDownload = (content: string, filename: string, mimeType: string) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
