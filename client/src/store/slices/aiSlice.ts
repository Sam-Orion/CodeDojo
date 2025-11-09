import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AIConversation, AIMessage, AIState } from '../../types';
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
  async ({ conversationId, content }: { conversationId: string; content: string }) => {
    const response = await fetch(`/api/v1/ai/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    const data: ApiResponse<AIMessage> = await response.json();

    if (!data.success || !data.data) {
      throw new Error(data.error || 'Failed to send message');
    }

    return { conversationId, message: data.data };
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

const initialState: AIState = {
  conversations: [],
  activeConversation: null,
  isLoading: false,
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
      const conversation = state.conversations.find((c) => c.id === action.payload.conversationId);
      if (conversation) {
        const newMessage: AIMessage = {
          id: `temp-${Date.now()}`,
          role: 'user',
          content: action.payload.content,
          timestamp: Date.now(),
        };
        conversation.messages.push(newMessage);
        conversation.updatedAt = new Date().toISOString();
      }
      if (state.activeConversation?.id === action.payload.conversationId) {
        const newMessage: AIMessage = {
          id: `temp-${Date.now()}`,
          role: 'user',
          content: action.payload.content,
          timestamp: Date.now(),
        };
        state.activeConversation.messages.push(newMessage);
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
        state.conversations.push(action.payload);
        state.activeConversation = action.payload;
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
        state.conversations = action.payload;
        state.error = null;
      })
      .addCase(fetchConversations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch conversations';
      })
      // Send Message
      .addCase(sendMessage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.isLoading = false;
        const { conversationId, message } = action.payload;
        const conversation = state.conversations.find((c) => c.id === conversationId);
        if (conversation) {
          // Remove temporary message if it exists
          conversation.messages = conversation.messages.filter((m) => !m.id.startsWith('temp-'));
          // Add the actual message
          conversation.messages.push(message);
          conversation.updatedAt = new Date().toISOString();
        }
        if (state.activeConversation?.id === conversationId) {
          state.activeConversation.messages = state.activeConversation.messages.filter(
            (m) => !m.id.startsWith('temp-')
          );
          state.activeConversation.messages.push(message);
          state.activeConversation.updatedAt = new Date().toISOString();
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to send message';
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

export const { setActiveConversation, addUserMessage, clearError } = aiSlice.actions;

export default aiSlice.reducer;
