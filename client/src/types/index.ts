// User and Authentication types
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Collaboration and Real-time types
export interface Room {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  participants: Participant[];
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  cursor?: CursorPosition;
  isActive: boolean;
  joinedAt: string;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface CollaborationState {
  currentRoom: Room | null;
  participants: ParticipantPresence[];
  isConnected: boolean;
  operationQueue: Operation[];
  documentContent: string;
  documentVersion: number;
  operationHistory: Operation[];
  pendingOperations: Operation[];
  connectionStatus: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  lastSyncTime: number | null;
  undoStack: Operation[];
  redoStack: Operation[];
}

export interface Operation {
  id: string;
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  attributes?: Record<string, any>;
  clientId: string;
  userId?: string;
  timestamp: number;
  version?: number;
  acked?: boolean;
}

export interface Selection {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface ParticipantPresence extends Participant {
  color: string;
  selection?: Selection;
  lastActivity: number;
}

export interface DocumentState {
  version: number;
  content: string;
  operationHistory: Operation[];
}

// File System types
export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  path: string;
  content?: string;
  size?: number;
  lastModified: string;
  children?: FileNode[];
}

export interface FileSystemState {
  root: FileNode | null;
  currentFile: FileNode | null;
  openFiles: FileNode[];
  isLoading: boolean;
  error: string | null;
  uploads?: UploadState[];
}

export interface UploadState {
  id: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  retryCount?: number;
}

// Terminal types
export interface TerminalSession {
  id: string;
  name?: string;
  language: string;
  mode: 'local' | 'cloud' | 'auto';
  status: 'running' | 'stopped' | 'error';
  output: string[];
  env: Record<string, string>;
  createdAt: string;
  lastActivity: string;
  currentCommand?: string;
  isExecuting?: boolean;
}

export interface TerminalState {
  sessions: TerminalSession[];
  activeSession: TerminalSession | null;
  isLoading: boolean;
  error: string | null;
  supportedLanguages: string[];
}

// AI Assistant types
export interface AIConversation {
  id: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
  title?: string;
  isFavorite?: boolean;
}

export type AIMessageRole = 'user' | 'assistant' | 'system';

export type AIMessageStatus = 'success' | 'error' | 'info' | 'pending';

export type AIMessageFeedback = 'up' | 'down' | null;

export interface AIMessage {
  id: string;
  role: AIMessageRole;
  content: string;
  timestamp: number;
  model?: string;
  tokenCount?: number;
  status?: AIMessageStatus;
  isStreaming?: boolean;
  feedback?: AIMessageFeedback;
  errorDetails?: string;
  suggestions?: string[];
}

export interface AIState {
  conversations: AIConversation[];
  activeConversation: AIConversation | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

// Storage Provider types
export type StorageProviderType = 'google_drive' | 'onedrive' | 'local';

export interface StorageProvider {
  id: string;
  type: StorageProviderType;
  name: string;
  isConnected: boolean;
  token?: string;
  refreshToken?: string;
  expiresAt?: number;
  email?: string;
  icon?: string;
  lastAccessed?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StorageProviderState {
  providers: StorageProvider[];
  currentProviderId: string | null;
  isLoading: boolean;
  error: string | null;
  isConnecting: boolean;
  connectionError: string | null;
}

// Toast types
export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface ToastState {
  toasts: Toast[];
}

// AI Code Completion types
export interface AICodeSuggestion {
  id: string;
  content: string;
  confidence: number;
  description?: string;
  range?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

export interface AICompletionContext {
  language: string;
  fileContent: string;
  cursorPosition: number;
  prefix: string;
  suffix: string;
  currentLine: string;
  fileName?: string;
}

export interface AICompletionRequest {
  context: AICompletionContext;
  maxSuggestions?: number;
  temperature?: number;
}

export interface AICompletionResponse {
  suggestions: AICodeSuggestion[];
  requestId: string;
  provider: string;
  model?: string;
}

export interface AISuggestionTelemetry {
  requestId: string;
  suggestionId: string;
  action: 'accepted' | 'rejected' | 'dismissed' | 'shown';
  timestamp: number;
  context?: Partial<AICompletionContext>;
}
