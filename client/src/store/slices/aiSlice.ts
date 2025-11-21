import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  AIConversation,
  AIMessage,
  AIMessageFeedback,
  AIMessageStatus,
  AIState,
  ConversationStatus,
} from '../../types';
import { ApiResponse } from '../../types';

// Async thunks
export const createConversation = createAsyncThunk('ai/createConversation', async () => {
  const response = await fetch('/api/v1/ai/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data: ApiResponse<AIConversation> = await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error || 'Failed to create conversation');
  }

  return data.data;
});

export const fetchConversations = createAsyncThunk(
  'ai/fetchConversations',
  async (status: ConversationStatus = 'active') => {
    const response = await fetch(`/api/v1/ai/conversations?status=${status}`);
    const data: ApiResponse<AIConversation[]> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch conversations');
    }

    return { status, conversations: data.data };
  }
);

export const fetchConversation = createAsyncThunk(
  'ai/fetchConversation',
  async (conversationId: string) => {
    const response = await fetch(`/api/v1/ai/conversations/${conversationId}`);
    const data: ApiResponse<AIConversation> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to fetch conversation');
    }

    return data.data;
  }
);

export const sendMessage = createAsyncThunk(
  'ai/sendMessage',
  async (
    {
      conversationId,
      content,
      provider,
    }: { conversationId: string; content: string; provider?: string },
    { rejectWithValue, signal }
  ) => {
    // Validate empty messages
    if (!content || content.trim().length === 0) {
      return rejectWithValue('Message content cannot be empty');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    // Link abort signals
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(`/api/v1/ai/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, content, provider }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-OK responses
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ApiResponse<{ userMessage: AIMessage; assistantMessage: AIMessage }> =
        await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to send message');
      }

      return { conversationId, messages: data.data };
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        return rejectWithValue('Request timeout. Please try again.');
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return rejectWithValue('Network error. Please check your connection and try again.');
      }

      // Handle other errors
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      return rejectWithValue(errorMessage);
    }
  }
);

export const retryLastMessage = createAsyncThunk(
  'ai/retryLastMessage',
  async (
    { conversationId }: { conversationId: string },
    { getState, dispatch, rejectWithValue }
  ) => {
    const state = getState() as { ai: AIState };
    const conversation = state.ai.conversations.find((c) => c.id === conversationId);

    if (!conversation) {
      return rejectWithValue('Conversation not found');
    }

    // Find the last user message
    const lastUserMessage = [...conversation.messages].reverse().find((msg) => msg.role === 'user');

    if (!lastUserMessage) {
      return rejectWithValue('No message to retry');
    }

    // Dispatch sendMessage with the last user message content
    return dispatch(
      sendMessage({
        conversationId,
        content: lastUserMessage.content,
      })
    ).unwrap();
  }
);

export const generateCode = createAsyncThunk(
  'ai/generateCode',
  async ({ prompt, language, context }: { prompt: string; language: string; context?: string }) => {
    const response = await fetch('/api/v1/ai/generate-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, language, context }),
    });
    const data: ApiResponse<{ code: string; explanation: string }> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to generate code');
    }

    return data.data;
  }
);

export const explainCode = createAsyncThunk(
  'ai/explainCode',
  async ({ code, language }: { code: string; language: string }) => {
    const response = await fetch('/api/v1/ai/explain-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language }),
    });
    const data: ApiResponse<{ explanation: string }> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to explain code');
    }

    return data.data.explanation;
  }
);

export const renameConversation = createAsyncThunk(
  'ai/renameConversation',
  async ({ conversationId, title }: { conversationId: string; title: string }) => {
    const response = await fetch(`/api/v1/ai/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    const data: ApiResponse<AIConversation> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to rename conversation');
    }

    return data.data;
  }
);

export const updateConversationStatus = createAsyncThunk(
  'ai/updateConversationStatus',
  async ({
    conversationId,
    status,
  }: {
    conversationId: string;
    status: Extract<ConversationStatus, 'active' | 'archived'>;
  }) => {
    const response = await fetch(`/api/v1/ai/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data: ApiResponse<AIConversation> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to update conversation status');
    }

    return data.data;
  }
);

export const deleteConversation = createAsyncThunk(
  'ai/deleteConversation',
  async ({ conversationId, force = false }: { conversationId: string; force?: boolean }) => {
    const endpoint = force
      ? `/api/v1/ai/conversations/${conversationId}?force=true`
      : `/api/v1/ai/conversations/${conversationId}`;

    const response = await fetch(endpoint, {
      method: 'DELETE',
    });
    const data: ApiResponse<AIConversation | { id: string; hardDeleted?: boolean }> =
      await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to delete conversation');
    }

    const payload = data.data as AIConversation & { id: string; hardDeleted?: boolean };

    if ('messages' in payload && payload.messages) {
      return { type: 'soft' as const, conversation: payload };
    }

    return { type: 'hard' as const, conversationId: payload.id };
  }
);

export const toggleFavoriteConversation = createAsyncThunk(
  'ai/toggleFavoriteConversation',
  async ({ conversationId, isFavorite }: { conversationId: string; isFavorite: boolean }) => {
    const response = await fetch(`/api/v1/ai/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite }),
    });
    const data: ApiResponse<AIConversation> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to toggle favorite');
    }

    return data.data;
  }
);

const normalizeMessage = (message: AIMessage): AIMessage => ({
  ...message,
  timestamp: message.timestamp ?? Date.now(),
  status: message.status ?? (message.role === 'system' ? 'info' : 'success'),
  feedback: message.feedback ?? null,
});

const normalizeConversation = (conversation: AIConversation): AIConversation => ({
  ...conversation,
  status: conversation.status ?? 'active',
  archivedAt: conversation.archivedAt ?? null,
  deletedAt: conversation.deletedAt ?? null,
  deletedBy: conversation.deletedBy ?? null,
  messages: conversation.messages?.map((message) => normalizeMessage(message)) ?? [],
});

const DEFAULT_CACHE_MAX_AGE_DAYS = 30;

const sortByUpdatedAtDesc = (list: AIConversation[]) =>
  list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

const findConversationInState = (state: AIState, conversationId: string) =>
  state.conversations.find((c) => c.id === conversationId) ||
  state.archivedConversations.find((c) => c.id === conversationId) ||
  state.deletedConversations.find((c) => c.id === conversationId);

const applyUpdateToConversation = (
  state: AIState,
  conversationId: string,
  updater: (conversation: AIConversation) => void
) => {
  const conversation = findConversationInState(state, conversationId);
  if (conversation) {
    updater(conversation);
  }

  if (
    state.activeConversation?.id === conversationId &&
    state.activeConversation !== conversation
  ) {
    updater(state.activeConversation);
  }
};

const removeConversationFromLists = (state: AIState, conversationId: string) => {
  state.conversations = state.conversations.filter((c) => c.id !== conversationId);
  state.archivedConversations = state.archivedConversations.filter((c) => c.id !== conversationId);
  state.deletedConversations = state.deletedConversations.filter((c) => c.id !== conversationId);
};

const upsertConversation = (state: AIState, conversation: AIConversation) => {
  removeConversationFromLists(state, conversation.id);

  const targetList =
    conversation.status === 'archived'
      ? state.archivedConversations
      : conversation.status === 'deleted'
        ? state.deletedConversations
        : state.conversations;

  targetList.push(conversation);
  sortByUpdatedAtDesc(targetList);

  if (state.activeConversation?.id === conversation.id) {
    state.activeConversation = conversation;
  }
};

const setActiveToFallbackConversation = (state: AIState) => {
  state.activeConversation = state.conversations[0] ?? null;
};

const initialState: AIState = {
  conversations: [],
  archivedConversations: [],
  deletedConversations: [],
  activeConversation: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
  cacheLastCleanup: null,
};

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    setActiveConversation: (state, action: PayloadAction<AIConversation | null>) => {
      state.activeConversation = action.payload;
    },
    addUserMessage: (state, action: PayloadAction<{ conversationId: string; content: string }>) => {
      const { conversationId, content } = action.payload;
      const timestamp = Date.now();
      const tempId = `temp-${timestamp}`;

      const baseMessage: AIMessage = {
        id: tempId,
        role: 'user',
        content,
        timestamp,
        status: 'success',
        feedback: null,
      };

      applyUpdateToConversation(state, conversationId, (conversation) => {
        conversation.messages.push({ ...baseMessage });
        conversation.updatedAt = new Date().toISOString();
      });
    },
    removeMessage: (
      state,
      action: PayloadAction<{ conversationId: string; messageId: string }>
    ) => {
      const { conversationId, messageId } = action.payload;
      applyUpdateToConversation(state, conversationId, (conversation) => {
        conversation.messages = conversation.messages.filter((m) => m.id !== messageId);
        conversation.updatedAt = new Date().toISOString();
      });
    },
    setMessageFeedback: (
      state,
      action: PayloadAction<{
        conversationId: string;
        messageId: string;
        feedback: AIMessageFeedback;
      }>
    ) => {
      const { conversationId, messageId, feedback } = action.payload;
      applyUpdateToConversation(state, conversationId, (conversation) => {
        const target = conversation.messages.find((m) => m.id === messageId);
        if (target) {
          target.feedback = feedback;
        }
      });
    },
    addSystemMessage: (
      state,
      action: PayloadAction<{
        conversationId: string;
        content: string;
        status?: AIMessageStatus;
        suggestions?: string[];
      }>
    ) => {
      const { conversationId, content, status = 'info', suggestions } = action.payload;
      const baseSystemMessage: AIMessage = {
        id: `system-${Date.now()}`,
        role: 'system',
        content,
        timestamp: Date.now(),
        status,
        suggestions,
        feedback: null,
      };
      const systemMessage = normalizeMessage(baseSystemMessage);

      applyUpdateToConversation(state, conversationId, (conversation) => {
        conversation.messages.push({ ...systemMessage });
        conversation.updatedAt = new Date().toISOString();
      });
    },
    clearError: (state) => {
      state.error = null;
    },
    updateStreamingMessage: (
      state,
      action: PayloadAction<{
        conversationId: string;
        messageId: string;
        content: string;
        tokenCount: number;
      }>
    ) => {
      const { conversationId, messageId, content, tokenCount } = action.payload;

      applyUpdateToConversation(state, conversationId, (target) => {
        let message = target.messages.find((m) => m.id === messageId);

        if (!message) {
          message = {
            id: messageId,
            role: 'assistant',
            content,
            timestamp: Date.now(),
            status: 'pending',
            isStreaming: true,
            tokenCount,
            feedback: null,
          };
          target.messages.push(message);
        } else {
          message.content = content;
          message.tokenCount = tokenCount;
          message.isStreaming = true;
        }
        target.updatedAt = new Date().toISOString();
      });
    },
    completeStreamingMessage: (
      state,
      action: PayloadAction<{
        conversationId: string;
        messageId: string;
        content: string;
        status: AIMessageStatus;
        tokenCount: number;
        errorDetails?: string;
      }>
    ) => {
      const { conversationId, messageId, content, status, tokenCount, errorDetails } =
        action.payload;

      applyUpdateToConversation(state, conversationId, (target) => {
        let message = target.messages.find((m) => m.id === messageId);

        if (!message) {
          message = {
            id: messageId,
            role: 'assistant',
            content,
            timestamp: Date.now(),
            status,
            isStreaming: false,
            tokenCount,
            feedback: null,
            errorDetails,
          };
          target.messages.push(message);
        } else {
          message.content = content;
          message.status = status;
          message.isStreaming = false;
          message.tokenCount = tokenCount;
          if (errorDetails) {
            message.errorDetails = errorDetails;
          }
        }
        target.updatedAt = new Date().toISOString();
      });
    },
    clearStreamingState: (state, action: PayloadAction<{ conversationId: string }>) => {
      const { conversationId } = action.payload;
      applyUpdateToConversation(state, conversationId, (conversation) => {
        conversation.messages = conversation.messages.filter((m) => !m.isStreaming);
        conversation.updatedAt = new Date().toISOString();
      });
    },
    clearConversationCache: (state) => {
      state.conversations = [];
      state.archivedConversations = [];
      state.deletedConversations = [];
      state.activeConversation = null;
      state.cacheLastCleanup = Date.now();
    },
    cleanupConversationCache: (
      state,
      action: PayloadAction<{ olderThanDays?: number } | undefined>
    ) => {
      const thresholdDays = action.payload?.olderThanDays ?? DEFAULT_CACHE_MAX_AGE_DAYS;
      const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000;
      const filterList = (list: AIConversation[]) =>
        list.filter((conversation) => new Date(conversation.updatedAt).getTime() >= cutoff);

      state.conversations = filterList(state.conversations);
      state.archivedConversations = filterList(state.archivedConversations);
      state.deletedConversations = filterList(state.deletedConversations);

      if (
        state.activeConversation &&
        new Date(state.activeConversation.updatedAt).getTime() < cutoff
      ) {
        setActiveToFallbackConversation(state);
      }

      state.cacheLastCleanup = Date.now();
    },
  },
  extraReducers: (builder) => {
    builder
      // Create Conversation
      .addCase(createConversation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createConversation.fulfilled, (state, action) => {
        state.isLoading = false;
        const normalizedConversation = normalizeConversation(action.payload);

        upsertConversation(state, normalizedConversation);
        state.activeConversation = normalizedConversation;
        state.error = null;
      })
      .addCase(createConversation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create conversation';
      })
      // Fetch Conversations
      .addCase(fetchConversations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.isLoading = false;
        const { status, conversations } = action.payload;
        const normalizedConversations = conversations.map((conversation) =>
          normalizeConversation(conversation)
        );
        sortByUpdatedAtDesc(normalizedConversations);

        if (status === 'archived') {
          state.archivedConversations = normalizedConversations;
        } else if (status === 'deleted') {
          state.deletedConversations = normalizedConversations;
        } else {
          state.conversations = normalizedConversations;

          if (!state.activeConversation || state.activeConversation.status === 'active') {
            if (normalizedConversations.length === 0) {
              state.activeConversation = null;
            } else if (state.activeConversation) {
              const updatedActive = normalizedConversations.find(
                (conversation) => conversation.id === state.activeConversation?.id
              );
              state.activeConversation = updatedActive ?? normalizedConversations[0];
            } else {
              state.activeConversation = normalizedConversations[0];
            }
          }
        }

        state.error = null;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch conversations';
      })
      // Fetch Conversation
      .addCase(fetchConversation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchConversation.fulfilled, (state, action) => {
        state.isLoading = false;
        const normalizedConversation = normalizeConversation(action.payload);

        upsertConversation(state, normalizedConversation);
        state.activeConversation = normalizedConversation;

        state.error = null;
      })
      .addCase(fetchConversation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch conversation';
      })
      // Send Message
      .addCase(sendMessage.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isSubmitting = false;
        const { conversationId, messages } = action.payload;
        const { userMessage, assistantMessage } = messages;

        const normalizedUserMessage = normalizeMessage(userMessage);
        const normalizedAssistantMessage = normalizeMessage(assistantMessage);

        applyUpdateToConversation(state, conversationId, (target) => {
          target.messages = target.messages.filter((m) => !m.id.startsWith('temp-'));
          target.messages.push({ ...normalizedUserMessage });
          target.messages.push({ ...normalizedAssistantMessage });
          target.updatedAt = new Date().toISOString();
        });
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isSubmitting = false;
        const errorMessage =
          (action.payload as string) || action.error.message || 'Failed to send message';
        state.error = errorMessage;

        const conversationId = action.meta.arg?.conversationId;
        if (!conversationId) {
          return;
        }

        const systemMessage = normalizeMessage({
          id: `error-${Date.now()}`,
          role: 'system',
          content: errorMessage,
          timestamp: Date.now(),
          status: 'error',
          suggestions: [
            'Check your network connection.',
            'Try regenerating the response.',
            'Review the prompt or context for potential issues.',
          ],
          feedback: null,
        });

        applyUpdateToConversation(state, conversationId, (target) => {
          target.messages = target.messages.filter((m) => !m.id.startsWith('temp-'));
          target.messages.push({ ...systemMessage });
          target.updatedAt = new Date().toISOString();
        });
      })
      // Retry Last Message
      .addCase(retryLastMessage.pending, (state) => {
        state.isSubmitting = true;
        state.error = null;
      })
      .addCase(retryLastMessage.fulfilled, (state) => {
        state.isSubmitting = false;
        // Messages are already handled by sendMessage.fulfilled
      })
      .addCase(retryLastMessage.rejected, (state, action) => {
        state.isSubmitting = false;
        state.error =
          (action.payload as string) || action.error.message || 'Failed to retry message';
      })
      // Generate Code
      .addCase(generateCode.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(generateCode.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(generateCode.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to generate code';
      })
      // Explain Code
      .addCase(explainCode.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(explainCode.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(explainCode.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to explain code';
      })
      // Rename Conversation
      .addCase(renameConversation.fulfilled, (state, action) => {
        const normalizedConversation = normalizeConversation(action.payload);
        upsertConversation(state, normalizedConversation);
      })
      .addCase(renameConversation.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to rename conversation';
      })
      .addCase(updateConversationStatus.fulfilled, (state, action) => {
        const normalizedConversation = normalizeConversation(action.payload);
        const wasActive =
          state.activeConversation?.id === normalizedConversation.id &&
          state.activeConversation.status === 'active';

        upsertConversation(state, normalizedConversation);

        if (wasActive && normalizedConversation.status !== 'active') {
          setActiveToFallbackConversation(state);
        }
      })
      .addCase(updateConversationStatus.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to update conversation status';
      })
      // Delete Conversation
      .addCase(deleteConversation.fulfilled, (state, action) => {
        if (action.payload.type === 'hard') {
          removeConversationFromLists(state, action.payload.conversationId);
          if (state.activeConversation?.id === action.payload.conversationId) {
            setActiveToFallbackConversation(state);
          }
          return;
        }

        const normalizedConversation = normalizeConversation(action.payload.conversation);
        const wasActive =
          state.activeConversation?.id === normalizedConversation.id &&
          state.activeConversation.status === 'active';

        upsertConversation(state, normalizedConversation);

        if (wasActive && normalizedConversation.status !== 'active') {
          setActiveToFallbackConversation(state);
        }
      })
      .addCase(deleteConversation.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to delete conversation';
      })
      // Toggle Favorite Conversation
      .addCase(toggleFavoriteConversation.fulfilled, (state, action) => {
        const normalizedConversation = normalizeConversation(action.payload);
        upsertConversation(state, normalizedConversation);
      })
      .addCase(toggleFavoriteConversation.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to toggle favorite';
      });
  },
});

export const {
  setActiveConversation,
  addUserMessage,
  removeMessage,
  setMessageFeedback,
  addSystemMessage,
  clearError,
  updateStreamingMessage,
  completeStreamingMessage,
  clearStreamingState,
  clearConversationCache,
  cleanupConversationCache,
} = aiSlice.actions;

export default aiSlice.reducer;
