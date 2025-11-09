export type WebSocketEventType =
  | 'JOIN_ROOM'
  | 'LEAVE_ROOM'
  | 'OT_OP'
  | 'CURSOR_UPDATE'
  | 'SYNC_STATE'
  | 'ACK'
  | 'ERROR'
  | 'PRESENCE_UPDATE'
  | 'TERMINAL_CREATE'
  | 'TERMINAL_INPUT'
  | 'TERMINAL_RESIZE'
  | 'TERMINAL_OUTPUT'
  | 'TERMINAL_EXIT'
  | 'TERMINAL_ERROR';

export interface WebSocketMessage {
  type: WebSocketEventType;
  payload?: Record<string, any>;
  timestamp?: number;
}

export interface WebSocketOptions {
  url?: string;
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private autoReconnect: boolean;
  private reconnectAttempts: number;
  private reconnectDelay: number;
  private currentAttempt = 0;
  private listeners: Map<
    WebSocketEventType | 'open' | 'close' | 'error',
    Set<(payload?: any) => void>
  > = new Map();
  private messageQueue: WebSocketMessage[] = [];
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(options: WebSocketOptions = {}) {
    this.url = options.url || this.getWebSocketUrl();
    this.autoReconnect = options.autoReconnect ?? true;
    this.reconnectAttempts = options.reconnectAttempts ?? 5;
    this.reconnectDelay = options.reconnectDelay ?? 3000;
  }

  private getWebSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.currentAttempt = 0;
          this.emit('open', null);
          this.flushMessageQueue();
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.emit(message.type, message.payload);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = (error: Event) => {
          this.emit('error', { message: 'WebSocket error' });
          reject(error);
        };

        this.ws.onclose = () => {
          this.emit('close', null);
          if (this.autoReconnect && this.currentAttempt < this.reconnectAttempts) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private scheduleReconnect(): void {
    this.currentAttempt++;
    const delay = this.reconnectDelay * Math.pow(2, this.currentAttempt - 1);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(message: WebSocketMessage): void {
    const payload = {
      ...message,
      timestamp: message.timestamp || Date.now(),
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    } else {
      this.messageQueue.push(payload);
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  on(
    event: WebSocketEventType | 'open' | 'close' | 'error',
    callback: (payload?: any) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  off(
    event: WebSocketEventType | 'open' | 'close' | 'error',
    callback: (payload?: any) => void
  ): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: WebSocketEventType | 'open' | 'close' | 'error', payload?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(payload);
        } catch (error) {
          console.error('Error in WebSocket event listener:', error);
        }
      });
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

export default WebSocketManager;
