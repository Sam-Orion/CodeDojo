import { TerminalSession } from '../types';

interface PersistedSession {
  id: string;
  name?: string;
  language: string;
  mode: 'local' | 'cloud' | 'auto';
  status: 'running' | 'stopped' | 'error';
  env: Record<string, string>;
  createdAt: string;
  lastActivity: string;
}

interface SessionPersistenceData {
  sessions: PersistedSession[];
  activeSessionId: string | null;
  lastSaved: number;
}

const STORAGE_KEY = 'terminal_sessions';
const MAX_SESSIONS = 50;
const SESSION_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

class SessionPersistence {
  private data: SessionPersistenceData | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SessionPersistenceData;
        const now = Date.now();

        // Check if data is too old
        if (now - parsed.lastSaved > SESSION_EXPIRY) {
          this.clearStorage();
          return;
        }

        this.data = {
          ...parsed,
          sessions: parsed.sessions.slice(0, MAX_SESSIONS),
        };
      }
    } catch (error) {
      console.error('Failed to load session persistence data:', error);
      this.clearStorage();
    }
  }

  private saveToStorage(): void {
    if (!this.data) return;

    try {
      this.data.lastSaved = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.error('Failed to save session persistence data:', error);
    }
  }

  private clearStorage(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear session persistence data:', error);
    }
    this.data = null;
  }

  saveSessions(sessions: TerminalSession[], activeSessionId: string | null): void {
    const persistedSessions: PersistedSession[] = sessions.map((session) => ({
      id: session.id,
      name: session.name,
      language: session.language,
      mode: session.mode,
      status: session.status,
      env: session.env,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
    }));

    this.data = {
      sessions: persistedSessions.slice(0, MAX_SESSIONS),
      activeSessionId,
      lastSaved: Date.now(),
    };

    this.saveToStorage();
  }

  getSessions(): PersistedSession[] {
    return this.data?.sessions || [];
  }

  getActiveSessionId(): string | null {
    return this.data?.activeSessionId || null;
  }

  clear(): void {
    this.clearStorage();
  }

  // Convert persisted sessions back to TerminalSession format
  restoreSessions(): { sessions: PersistedSession[]; activeSessionId: string | null } {
    return {
      sessions: this.getSessions(),
      activeSessionId: this.getActiveSessionId(),
    };
  }

  // Get recent sessions for history
  getRecentSessions(limit = 10): PersistedSession[] {
    const sessions = this.getSessions();
    return sessions
      .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
      .slice(0, limit);
  }

  // Remove old sessions to keep storage clean
  cleanup(): void {
    if (!this.data) return;

    const now = Date.now();
    const validSessions = this.data.sessions.filter(
      (session) => now - new Date(session.lastActivity).getTime() < SESSION_EXPIRY
    );

    if (validSessions.length !== this.data.sessions.length) {
      this.data.sessions = validSessions;
      this.saveToStorage();
    }
  }
}

export default new SessionPersistence();
