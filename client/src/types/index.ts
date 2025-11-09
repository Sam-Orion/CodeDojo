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
  participants: Participant[];
  isConnected: boolean;
  operationQueue: Operation[];
}

export interface Operation {
  id: string;
  type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  attributes?: Record<string, any>;
  clientId: string;
  timestamp: number;
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
}

// Terminal types
export interface TerminalSession {
  id: string;
  language: string;
  mode: 'local' | 'cloud' | 'auto';
  status: 'running' | 'stopped' | 'error';
  output: string[];
  env: Record<string, string>;
  createdAt: string;
  lastActivity: string;
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
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AIState {
  conversations: AIConversation[];
  activeConversation: AIConversation | null;
  isLoading: boolean;
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
