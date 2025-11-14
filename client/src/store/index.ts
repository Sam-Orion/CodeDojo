import { z } from 'zod';
import { configureStore, Middleware } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

// Import slices (will be created next)
import authSlice from './slices/authSlice';
import collaborationSlice from './slices/collaborationSlice';
import filesSlice from './slices/filesSlice';
import terminalSlice from './slices/terminalSlice';
import aiSlice from './slices/aiSlice';
import storageProviderSlice from './slices/storageProviderSlice';
import toastSlice, { addToast } from './slices/toastSlice';

// Zod schema for validating the entire Redux state
export const RootStateSchema = z.object({
  auth: z.object({
    user: z
      .object({
        id: z.string(),
        username: z.string(),
        email: z.string(),
        avatar: z.string().optional(),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
      .nullable(),
    token: z.string().nullable(),
    isAuthenticated: z.boolean(),
    isLoading: z.boolean(),
    error: z.string().nullable(),
  }),
  collaboration: z.object({
    currentRoom: z
      .object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
        ownerId: z.string(),
        participants: z.array(
          z.object({
            id: z.string(),
            userId: z.string(),
            username: z.string(),
            avatar: z.string().optional(),
            cursor: z
              .object({
                line: z.number(),
                column: z.number(),
              })
              .optional(),
            isActive: z.boolean(),
            joinedAt: z.string(),
          })
        ),
        createdAt: z.string(),
        updatedAt: z.string(),
      })
      .nullable(),
    participants: z.array(z.any()),
    isConnected: z.boolean(),
    operationQueue: z.array(z.any()),
    documentContent: z.string(),
    documentVersion: z.number(),
    operationHistory: z.array(z.any()),
    pendingOperations: z.array(z.any()),
    connectionStatus: z.enum(['idle', 'connecting', 'connected', 'disconnected', 'error']),
    lastSyncTime: z.number().nullable(),
    undoStack: z.array(z.any()),
    redoStack: z.array(z.any()),
  }),
  files: z.object({
    root: z.any().nullable(),
    currentFile: z.any().nullable(),
    openFiles: z.array(z.any()),
    isLoading: z.boolean(),
    error: z.string().nullable(),
  }),
  terminal: z.object({
    sessions: z.array(z.any()),
    activeSession: z.any().nullable(),
    isLoading: z.boolean(),
    error: z.string().nullable(),
    supportedLanguages: z.array(z.string()),
  }),
  ai: z.object({
    conversations: z.array(z.any()),
    activeConversation: z.any().nullable(),
    isLoading: z.boolean(),
    isSubmitting: z.boolean(),
    error: z.string().nullable(),
  }),
  storageProvider: z.object({
    providers: z.array(z.any()),
    currentProviderId: z.string().nullable(),
    isLoading: z.boolean(),
    error: z.string().nullable(),
    isConnecting: z.boolean(),
    connectionError: z.string().nullable(),
  }),
  toast: z.object({
    toasts: z.array(
      z.object({
        id: z.string(),
        message: z.string(),
        type: z.enum(['success', 'error', 'warning', 'info']),
        duration: z.number().optional(),
      })
    ),
  }),
});

export type RootState = z.infer<typeof RootStateSchema>;

// Middleware to show toast notifications for AI errors
const aiErrorToastMiddleware: Middleware = (store) => (next) => (action) => {
  const result = next(action);

  // Check if it's a rejected AI action
  if (action.type?.startsWith('ai/') && action.type?.endsWith('/rejected')) {
    const errorMessage =
      action.payload || action.error?.message || 'An error occurred with the AI service';

    // Show error toast
    store.dispatch(
      addToast({
        message: errorMessage,
        type: 'error',
        duration: 5000,
      })
    );
  }

  // Check if message was sent successfully
  if (action.type === 'ai/sendMessage/fulfilled') {
    store.dispatch(
      addToast({
        message: 'Message sent successfully',
        type: 'success',
        duration: 3000,
      })
    );
  }

  return result;
};

// Configure the Redux store
export const store = configureStore({
  reducer: {
    auth: authSlice,
    collaboration: collaborationSlice,
    files: filesSlice,
    terminal: terminalSlice,
    ai: aiSlice,
    storageProvider: storageProviderSlice,
    toast: toastSlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }).concat(aiErrorToastMiddleware),
  devTools: process.env.NODE_ENV !== 'production',
});

// Type hooks for TypeScript
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Validation function for state integrity
export const validateState = (state: unknown): RootState => {
  return RootStateSchema.parse(state);
};
