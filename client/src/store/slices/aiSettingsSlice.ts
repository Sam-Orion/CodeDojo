import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface AICredential {
  _id: string;
  userId: string;
  provider: 'openai' | 'anthropic' | 'azure-openai' | 'gemini';
  displayName: string;
  keyId: string;
  isActive: boolean;
  usageCount: number;
  lastUsedAt?: string;
  metadata?: {
    model?: string;
    baseURL?: string;
    organization?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProviderConfig {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  capabilities: string[];
  documentation: string;
}

export interface AISettings {
  defaultProvider: string | null;
  chatProvider: string | null;
  codeProvider: string | null;
  fallbackProvider: string | null;
}

export interface UsageStats {
  totalCredentials: number;
  activeCredentials: number;
  totalUsage: number;
  byProvider: {
    [key: string]: {
      count: number;
      usage: number;
    };
  };
  credentials: AICredential[];
}

interface AISettingsState {
  credentials: AICredential[];
  settings: AISettings;
  usageStats: UsageStats | null;
  supportedProviders: ProviderConfig[];
  isLoading: boolean;
  isTesting: { [key: string]: boolean };
  error: string | null;
  testResults: {
    [key: string]: {
      success: boolean;
      message?: string;
      timestamp: number;
    };
  };
}

const supportedProviders: ProviderConfig[] = [
  {
    name: 'openai',
    displayName: 'OpenAI (GPT)',
    description: 'GPT-4, GPT-3.5 Turbo, and other OpenAI models',
    icon: '🤖',
    capabilities: ['Chat', 'Code Generation', 'Code Explanation'],
    documentation: 'https://platform.openai.com/docs',
  },
  {
    name: 'anthropic',
    displayName: 'Anthropic (Claude)',
    description: 'Claude 3.5 Sonnet, Claude 3 Opus, and other Claude models',
    icon: '🧠',
    capabilities: ['Chat', 'Code Generation', 'Code Explanation'],
    documentation: 'https://docs.anthropic.com',
  },
  {
    name: 'gemini',
    displayName: 'Google Gemini',
    description: 'Gemini Pro and other Google AI models',
    icon: '✨',
    capabilities: ['Chat', 'Code Generation', 'Code Explanation'],
    documentation: 'https://ai.google.dev/docs',
  },
  {
    name: 'azure-openai',
    displayName: 'Azure OpenAI',
    description: 'OpenAI models hosted on Microsoft Azure',
    icon: '☁️',
    capabilities: ['Chat', 'Code Generation', 'Code Explanation'],
    documentation: 'https://learn.microsoft.com/azure/ai-services/openai/',
  },
];

export const fetchCredentials = createAsyncThunk('aiSettings/fetchCredentials', async () => {
  const response = await fetch('/api/v1/ai/credentials', {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch credentials' }));
    throw new Error(error.error || 'Failed to fetch credentials');
  }

  const data = await response.json();
  return data.credentials as AICredential[];
});

export const createCredential = createAsyncThunk(
  'aiSettings/createCredential',
  async (payload: {
    provider: string;
    apiKey: string;
    displayName: string;
    metadata?: Record<string, unknown>;
  }) => {
    const response = await fetch('/api/v1/ai/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create credential' }));
      throw new Error(error.error || 'Failed to create credential');
    }

    const data = await response.json();
    return data as AICredential;
  }
);

export const updateCredential = createAsyncThunk(
  'aiSettings/updateCredential',
  async (payload: {
    id: string;
    displayName?: string;
    apiKey?: string;
    metadata?: Record<string, unknown>;
    isActive?: boolean;
  }) => {
    const { id, ...updates } = payload;
    const response = await fetch(`/api/v1/ai/credentials/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update credential' }));
      throw new Error(error.error || 'Failed to update credential');
    }

    const data = await response.json();
    return data as AICredential;
  }
);

export const deleteCredential = createAsyncThunk(
  'aiSettings/deleteCredential',
  async (id: string) => {
    const response = await fetch(`/api/v1/ai/credentials/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete credential' }));
      throw new Error(error.error || 'Failed to delete credential');
    }

    return id;
  }
);

export const testCredential = createAsyncThunk(
  'aiSettings/testCredential',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/v1/ai/credentials/${id}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue({ id, message: data.error || 'Test failed' });
      }

      return { id, success: data.success, message: data.testResponse };
    } catch (error) {
      return rejectWithValue({
        id,
        message: error instanceof Error ? error.message : 'Network error',
      });
    }
  }
);

export const fetchUsageStats = createAsyncThunk('aiSettings/fetchUsageStats', async () => {
  const response = await fetch('/api/v1/ai/credentials/stats', {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch usage stats' }));
    throw new Error(error.error || 'Failed to fetch usage stats');
  }

  const data = await response.json();
  return data as UsageStats;
});

const initialSettings: AISettings = {
  defaultProvider: localStorage.getItem('ai_defaultProvider') || null,
  chatProvider: localStorage.getItem('ai_chatProvider') || null,
  codeProvider: localStorage.getItem('ai_codeProvider') || null,
  fallbackProvider: localStorage.getItem('ai_fallbackProvider') || null,
};

const initialState: AISettingsState = {
  credentials: [],
  settings: initialSettings,
  usageStats: null,
  supportedProviders,
  isLoading: false,
  isTesting: {},
  error: null,
  testResults: {},
};

const aiSettingsSlice = createSlice({
  name: 'aiSettings',
  initialState,
  reducers: {
    updateSettings: (state, action: PayloadAction<Partial<AISettings>>) => {
      state.settings = { ...state.settings, ...action.payload };
      Object.entries(action.payload).forEach(([key, value]) => {
        if (value) {
          localStorage.setItem(`ai_${key}`, value as string);
        } else {
          localStorage.removeItem(`ai_${key}`);
        }
      });
    },
    clearError: (state) => {
      state.error = null;
    },
    clearTestResult: (state, action: PayloadAction<string>) => {
      delete state.testResults[action.payload];
    },
    exportSettings: (state) => {
      const exportData = {
        settings: state.settings,
        credentials: state.credentials.map((cred) => ({
          provider: cred.provider,
          displayName: cred.displayName,
          metadata: cred.metadata,
        })),
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-settings-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCredentials.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCredentials.fulfilled, (state, action) => {
        state.isLoading = false;
        state.credentials = action.payload;
        state.error = null;
      })
      .addCase(fetchCredentials.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch credentials';
      })
      .addCase(createCredential.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createCredential.fulfilled, (state, action) => {
        state.isLoading = false;
        state.credentials.push(action.payload);
        state.error = null;
      })
      .addCase(createCredential.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to create credential';
      })
      .addCase(updateCredential.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateCredential.fulfilled, (state, action) => {
        state.isLoading = false;
        const index = state.credentials.findIndex((c) => c._id === action.payload._id);
        if (index !== -1) {
          state.credentials[index] = action.payload;
        }
        state.error = null;
      })
      .addCase(updateCredential.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to update credential';
      })
      .addCase(deleteCredential.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteCredential.fulfilled, (state, action) => {
        state.isLoading = false;
        state.credentials = state.credentials.filter((c) => c._id !== action.payload);
        state.error = null;
      })
      .addCase(deleteCredential.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to delete credential';
      })
      .addCase(testCredential.pending, (state, action) => {
        state.isTesting[action.meta.arg] = true;
      })
      .addCase(testCredential.fulfilled, (state, action) => {
        const { id, success, message } = action.payload;
        state.isTesting[id] = false;
        state.testResults[id] = {
          success,
          message,
          timestamp: Date.now(),
        };
      })
      .addCase(testCredential.rejected, (state, action) => {
        const payload = action.payload as { id: string; message: string };
        state.isTesting[payload.id] = false;
        state.testResults[payload.id] = {
          success: false,
          message: payload.message,
          timestamp: Date.now(),
        };
      })
      .addCase(fetchUsageStats.fulfilled, (state, action) => {
        state.usageStats = action.payload;
      });
  },
});

export const { updateSettings, clearError, clearTestResult, exportSettings } =
  aiSettingsSlice.actions;
export default aiSettingsSlice.reducer;
