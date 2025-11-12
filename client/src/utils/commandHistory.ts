interface CommandHistoryEntry {
  command: string;
  timestamp: number;
  language?: string;
}

const STORAGE_KEY = 'terminal_command_history';
const MAX_HISTORY = 100;
const HISTORY_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

class CommandHistory {
  private history: CommandHistoryEntry[] = [];
  private currentIndex = -1;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const now = Date.now();
        this.history = parsed.filter(
          (entry: CommandHistoryEntry) => now - entry.timestamp < HISTORY_EXPIRY
        );
      }
    } catch (error) {
      console.error('Failed to load command history:', error);
      this.history = [];
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history.slice(0, MAX_HISTORY)));
    } catch (error) {
      console.error('Failed to save command history:', error);
    }
  }

  add(command: string, language?: string): void {
    if (!command.trim()) return;

    const entry: CommandHistoryEntry = {
      command: command.trim(),
      timestamp: Date.now(),
      language,
    };

    this.history.unshift(entry);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(0, MAX_HISTORY);
    }

    this.currentIndex = -1;
    this.saveToStorage();
  }

  getPrevious(): string | null {
    if (this.history.length === 0) return null;
    this.currentIndex = Math.min(this.currentIndex + 1, this.history.length - 1);
    return this.history[this.currentIndex].command;
  }

  getNext(): string | null {
    if (this.history.length === 0) return null;
    this.currentIndex = Math.max(this.currentIndex - 1, -1);
    return this.currentIndex >= 0 ? this.history[this.currentIndex].command : null;
  }

  resetIndex(): void {
    this.currentIndex = -1;
  }

  getAll(limit?: number): CommandHistoryEntry[] {
    return this.history.slice(0, limit);
  }

  search(query: string, limit = 10): CommandHistoryEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.history
      .filter((entry) => entry.command.toLowerCase().includes(lowerQuery))
      .slice(0, limit);
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear command history:', error);
    }
  }
}

export default new CommandHistory();
