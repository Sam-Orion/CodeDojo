import WebSocketManager from '../utils/websocketManager';
import { Operation, CursorPosition, Selection } from '../types';

export interface EditorWebSocketControllerOptions {
  roomId: string;
  clientId: string;
  userId: string;
  onJoinRoomAck: (payload: Record<string, any>) => void;
  onOperationBroadcast: (payload: {
    operation: Operation;
    version: number;
    senderClientId: string;
  }) => void;
  onCursorUpdate: (payload: Record<string, any>) => void;
  onParticipantJoined: (payload: Record<string, any>) => void;
  onParticipantLeft: (payload: Record<string, any>) => void;
  onError: (error: Record<string, any>) => void;
}

export class EditorWebSocketController {
  private ws: WebSocketManager;
  private roomId: string;
  private clientId: string;
  private userId: string;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private options: EditorWebSocketControllerOptions;

  constructor(options: EditorWebSocketControllerOptions) {
    this.ws = new WebSocketManager();
    this.roomId = options.roomId;
    this.clientId = options.clientId;
    this.userId = options.userId;
    this.options = options;
  }

  async connect(userInfo?: any): Promise<void> {
    try {
      await this.ws.connect();
      this.startHeartbeat();
      await this.joinRoom(userInfo);
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      throw error;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws.isConnected()) {
        this.ws.send({
          type: 'ping' as any,
          payload: { timestamp: Date.now() },
        });
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  joinRoom(userInfo?: any): void {
    this.ws.send({
      type: 'JOIN_ROOM' as any,
      payload: {
        roomId: this.roomId,
        clientId: this.clientId,
        userId: this.userId,
        userInfo,
      },
    });

    this.registerEventHandlers();
  }

  private registerEventHandlers(): void {
    this.ws.on('JOIN_ROOM_ACK' as any, (payload) => {
      this.options.onJoinRoomAck(payload);
    });

    this.ws.on('OT_OP_BROADCAST' as any, (payload) => {
      this.options.onOperationBroadcast(payload);
    });

    this.ws.on('CURSOR_UPDATE' as any, (payload) => {
      this.options.onCursorUpdate(payload);
    });

    this.ws.on('PARTICIPANT_JOINED' as any, (payload) => {
      this.options.onParticipantJoined(payload);
    });

    this.ws.on('PARTICIPANT_LEFT' as any, (payload) => {
      this.options.onParticipantLeft(payload);
    });

    this.ws.on('ERROR' as any, (payload) => {
      this.options.onError(payload);
    });
  }

  sendOperation(operation: Operation): void {
    this.ws.send({
      type: 'OT_OP',
      payload: {
        roomId: this.roomId,
        clientId: this.clientId,
        userId: this.userId,
        operation,
      },
    });
  }

  sendCursorUpdate(cursor: CursorPosition): void {
    this.ws.send({
      type: 'CURSOR_UPDATE',
      payload: {
        roomId: this.roomId,
        clientId: this.clientId,
        cursor,
      },
    });
  }

  sendSelectionUpdate(selection: Selection): void {
    this.ws.send({
      type: 'CURSOR_UPDATE',
      payload: {
        roomId: this.roomId,
        clientId: this.clientId,
        selection,
      },
    });
  }

  leaveRoom(): void {
    this.stopHeartbeat();

    this.ws.send({
      type: 'LEAVE_ROOM',
      payload: {
        roomId: this.roomId,
        clientId: this.clientId,
      },
    });

    this.ws.disconnect();
  }

  isConnected(): boolean {
    return this.ws.isConnected();
  }

  getReadyState(): number {
    return this.ws.getReadyState();
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.ws.disconnect();
  }
}

export const createEditorWebSocketController = (
  options: EditorWebSocketControllerOptions
): EditorWebSocketController => {
  return new EditorWebSocketController(options);
};
