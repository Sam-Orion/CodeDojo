import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import {
  AIConversation,
  AIMessage,
  AIMessageFeedback,
  AIMessageStatus,
  AIState,
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

export const fetchConversations = createAsyncThunk('ai/fetchConversations', async () => {
  const response = await fetch('/api/v1/ai/conversations');
  const data: ApiResponse<AIConversation[]> = await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error || 'Failed to fetch conversations');
  }

  return data.data;
});

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

const normalizeMessage = (message: AIMessage): AIMessage => ({
  ...message,
  timestamp: message.timestamp ?? Date.now(),
  status: message.status ?? (message.role === 'system' ? 'info' : 'success'),
  feedback: message.feedback ?? null,
});

const initialState: AIState = {
  conversations: [],
  activeConversation: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
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

      const conversation = state.conversations.find((c) => c.id === conversationId);
      if (conversation) {
        conversation.messages.push({ ...baseMessage });
        conversation.updatedAt = new Date().toISOString();
      }

      if (
        state.activeConversation?.id === conversationId &&
        state.activeConversation !== conversation
      ) {
        state.activeConversation.messages.push({ ...baseMessage });
        state.activeConversation.updatedAt = new Date().toISOString();
      }
    },
    removeMessage: (
      state,
      action: PayloadAction<{ conversationId: string; messageId: string }>
    ) => {
      const { conversationId, messageId } = action.payload;
      const conversation = state.conversations.find((c) => c.id === conversationId);
      if (conversation) {
        conversation.messages = conversation.messages.filter((m) => m.id !== messageId);
        conversation.updatedAt = new Date().toISOString();
      }
      if (
        state.activeConversation?.id === conversationId &&
        state.activeConversation !== conversation
      ) {
        state.activeConversation.messages = state.activeConversation.messages.filter(
          (m) => m.id !== messageId
        );
        state.activeConversation.updatedAt = new Date().toISOString();
      }
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
      const updateFeedback = (message?: AIMessage) => {
        if (message) {
          message.feedback = feedback;
        }
      };

      const conversation = state.conversations.find((c) => c.id === conversationId);
      if (conversation) {
        updateFeedback(conversation.messages.find((m) => m.id === messageId));
      }
      if (
        state.activeConversation?.id === conversationId &&
        state.activeConversation !== conversation
      ) {
        updateFeedback(state.activeConversation.messages.find((m) => m.id === messageId));
      }
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

      const conversation = state.conversations.find((c) => c.id === conversationId);
      if (conversation) {
        conversation.messages.push({ ...systemMessage });
        conversation.updatedAt = new Date().toISOString();
      }
      if (
        state.activeConversation?.id === conversationId &&
        state.activeConversation !== conversation
      ) {
        state.activeConversation.messages.push({ ...systemMessage });
        state.activeConversation.updatedAt = new Date().toISOString();
      }
    },
    clearError: (state) => {
      state.error = null;
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
        const normalizedConversation: AIConversation = {
          ...action.payload,
          messages: action.payload.messages?.map((message) => normalizeMessage(message)) ?? [],
        };

        state.conversations = state.conversations.filter((c) => c.id !== normalizedConversation.id);
        state.conversations.push(normalizedConversation);
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
        const normalizedConversations = action.payload.map((conversation) => ({
          ...conversation,
          messages: conversation.messages?.map((message) => normalizeMessage(message)) ?? [],
        }));

        state.conversations = normalizedConversations;

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

        state.error = null;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch conversations';
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

        const updateConversation = (target?: AIConversation) => {
          if (!target) return;
          // Remove temporary messages
          target.messages = target.messages.filter((m) => !m.id.startsWith('temp-'));
          // Add both user and assistant messages
          target.messages.push({ ...normalizedUserMessage });
          target.messages.push({ ...normalizedAssistantMessage });
          target.updatedAt = new Date().toISOString();
        };

        const conversation = state.conversations.find((c) => c.id === conversationId);
        updateConversation(conversation);

        if (
          state.activeConversation?.id === conversationId &&
          state.activeConversation !== conversation
        ) {
          updateConversation(state.activeConversation);
        }
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

        const updateConversation = (target?: AIConversation) => {
          if (!target) return;
          target.messages = target.messages.filter((m) => !m.id.startsWith('temp-'));
          target.messages.push({ ...systemMessage });
          target.updatedAt = new Date().toISOString();
        };

        const conversation = state.conversations.find((c) => c.id === conversationId);
        updateConversation(conversation);

        if (
          state.activeConversation?.id === conversationId &&
          state.activeConversation !== conversation
        ) {
          updateConversation(state.activeConversation);
        }
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
} = aiSlice.actions;

export default aiSlice.reducer;
