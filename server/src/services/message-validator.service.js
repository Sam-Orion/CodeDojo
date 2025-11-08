const MessageTypes = {
  JOIN_ROOM: 'JOIN_ROOM',
  LEAVE_ROOM: 'LEAVE_ROOM',
  OT_OP: 'OT_OP',
  CURSOR_UPDATE: 'CURSOR_UPDATE',
  SYNC_STATE: 'SYNC_STATE',
  ERROR: 'ERROR',
  ACK: 'ACK',
  PRESENCE_UPDATE: 'PRESENCE_UPDATE',
  TERMINAL_CREATE: 'TERMINAL_CREATE',
  TERMINAL_INPUT: 'TERMINAL_INPUT',
  TERMINAL_RESIZE: 'TERMINAL_RESIZE',
  TERMINAL_OUTPUT: 'TERMINAL_OUTPUT',
  TERMINAL_EXIT: 'TERMINAL_EXIT',
  TERMINAL_ERROR: 'TERMINAL_ERROR',
  AI_COMPLETION_REQUEST: 'AI_COMPLETION_REQUEST',
  AI_COMPLETION_CANCEL: 'AI_COMPLETION_CANCEL',
  AI_EXPLAIN_REQUEST: 'AI_EXPLAIN_REQUEST',
  AI_REFACTOR_REQUEST: 'AI_REFACTOR_REQUEST',
  AI_FEEDBACK: 'AI_FEEDBACK',
};

const operationTypes = ['insert', 'delete'];

class ValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message);
    this.code = code;
    this.name = 'ValidationError';
  }
}

class MessageValidator {
  constructor() {
    this.schemas = this.initializeSchemas();
  }

  initializeSchemas() {
    return {
      JOIN_ROOM: {
        required: ['type', 'roomId', 'userId', 'clientId'],
        optional: ['documentId', 'userInfo'],
        validate: (msg) => {
          if (typeof msg.roomId !== 'string' || msg.roomId.trim() === '') {
            throw new ValidationError('roomId must be a non-empty string');
          }
          if (typeof msg.userId !== 'string' || msg.userId.trim() === '') {
            throw new ValidationError('userId must be a non-empty string');
          }
          if (typeof msg.clientId !== 'string' || msg.clientId.trim() === '') {
            throw new ValidationError('clientId must be a non-empty string');
          }
          if (msg.roomId.length > 100) {
            throw new ValidationError('roomId must be <= 100 characters');
          }
          if (msg.userId.length > 100) {
            throw new ValidationError('userId must be <= 100 characters');
          }
        },
      },

      LEAVE_ROOM: {
        required: ['type', 'roomId', 'clientId'],
        optional: [],
        validate: (msg) => {
          if (typeof msg.roomId !== 'string' || msg.roomId.trim() === '') {
            throw new ValidationError('roomId must be a non-empty string');
          }
          if (typeof msg.clientId !== 'string' || msg.clientId.trim() === '') {
            throw new ValidationError('clientId must be a non-empty string');
          }
        },
      },

      OT_OP: {
        required: ['type', 'roomId', 'clientId', 'operation'],
        optional: ['userId'],
        validate: (msg) => {
          if (typeof msg.roomId !== 'string' || msg.roomId.trim() === '') {
            throw new ValidationError('roomId must be a non-empty string');
          }
          if (typeof msg.clientId !== 'string' || msg.clientId.trim() === '') {
            throw new ValidationError('clientId must be a non-empty string');
          }
          if (!msg.operation || typeof msg.operation !== 'object') {
            throw new ValidationError('operation must be an object');
          }

          const op = msg.operation;
          if (!op.id || typeof op.id !== 'string') {
            throw new ValidationError('operation.id must be a non-empty string');
          }
          if (typeof op.version !== 'number' || op.version < 0) {
            throw new ValidationError('operation.version must be a non-negative number');
          }
          if (!operationTypes.includes(op.type)) {
            throw new ValidationError(
              `operation.type must be one of: ${operationTypes.join(', ')}`
            );
          }
          if (typeof op.position !== 'number' || op.position < 0) {
            throw new ValidationError('operation.position must be a non-negative number');
          }
          if (typeof op.content !== 'string') {
            throw new ValidationError('operation.content must be a string');
          }
          if (op.content.length > 10000) {
            throw new ValidationError('operation.content must be <= 10000 characters');
          }
        },
      },

      CURSOR_UPDATE: {
        required: ['type', 'roomId', 'clientId', 'cursor'],
        optional: ['userId'],
        validate: (msg) => {
          if (typeof msg.roomId !== 'string' || msg.roomId.trim() === '') {
            throw new ValidationError('roomId must be a non-empty string');
          }
          if (typeof msg.clientId !== 'string' || msg.clientId.trim() === '') {
            throw new ValidationError('clientId must be a non-empty string');
          }
          if (!msg.cursor || typeof msg.cursor !== 'object') {
            throw new ValidationError('cursor must be an object');
          }

          const cursor = msg.cursor;
          if (typeof cursor.line !== 'number' || cursor.line < 0) {
            throw new ValidationError('cursor.line must be a non-negative number');
          }
          if (typeof cursor.column !== 'number' || cursor.column < 0) {
            throw new ValidationError('cursor.column must be a non-negative number');
          }
        },
      },

      SYNC_STATE: {
        required: ['type', 'roomId', 'clientId'],
        optional: ['fromVersion'],
        validate: (msg) => {
          if (typeof msg.roomId !== 'string' || msg.roomId.trim() === '') {
            throw new ValidationError('roomId must be a non-empty string');
          }
          if (typeof msg.clientId !== 'string' || msg.clientId.trim() === '') {
            throw new ValidationError('clientId must be a non-empty string');
          }
          if (
            msg.fromVersion !== undefined &&
            (typeof msg.fromVersion !== 'number' || msg.fromVersion < 0)
          ) {
            throw new ValidationError('fromVersion must be a non-negative number');
          }
        },
      },

      ACK: {
        required: ['type', 'roomId', 'clientId', 'operationId'],
        optional: [],
        validate: (msg) => {
          if (typeof msg.roomId !== 'string' || msg.roomId.trim() === '') {
            throw new ValidationError('roomId must be a non-empty string');
          }
          if (typeof msg.clientId !== 'string' || msg.clientId.trim() === '') {
            throw new ValidationError('clientId must be a non-empty string');
          }
          if (typeof msg.operationId !== 'string' || msg.operationId.trim() === '') {
            throw new ValidationError('operationId must be a non-empty string');
          }
        },
      },

      PRESENCE_UPDATE: {
        required: ['type', 'roomId', 'clientId'],
        optional: ['userId', 'status'],
        validate: (msg) => {
          if (typeof msg.roomId !== 'string' || msg.roomId.trim() === '') {
            throw new ValidationError('roomId must be a non-empty string');
          }
          if (typeof msg.clientId !== 'string' || msg.clientId.trim() === '') {
            throw new ValidationError('clientId must be a non-empty string');
          }
        },
      },

      TERMINAL_CREATE: {
        required: ['type', 'clientId', 'language'],
        optional: [
          'userId',
          'roomId',
          'file',
          'workspaceDir',
          'isRepl',
          'mode',
          'useContainer',
          'env',
          'metadata',
        ],
        validate: (msg) => {
          if (typeof msg.clientId !== 'string' || msg.clientId.trim() === '') {
            throw new ValidationError('clientId must be a non-empty string');
          }
          if (typeof msg.language !== 'string' || msg.language.trim() === '') {
            throw new ValidationError('language must be a non-empty string');
          }
          if (msg.mode && !['local', 'cloud', 'auto'].includes(msg.mode)) {
            throw new ValidationError('mode must be one of: local, cloud, auto');
          }
        },
      },

      TERMINAL_INPUT: {
        required: ['type', 'sessionId', 'data'],
        optional: [],
        validate: (msg) => {
          if (typeof msg.sessionId !== 'string' || msg.sessionId.trim() === '') {
            throw new ValidationError('sessionId must be a non-empty string');
          }
          if (typeof msg.data !== 'string') {
            throw new ValidationError('data must be a string');
          }
        },
      },

      TERMINAL_RESIZE: {
        required: ['type', 'sessionId', 'cols', 'rows'],
        optional: [],
        validate: (msg) => {
          if (typeof msg.sessionId !== 'string' || msg.sessionId.trim() === '') {
            throw new ValidationError('sessionId must be a non-empty string');
          }
          if (typeof msg.cols !== 'number' || msg.cols <= 0 || msg.cols > 500) {
            throw new ValidationError('cols must be a number between 1 and 500');
          }
          if (typeof msg.rows !== 'number' || msg.rows <= 0 || msg.rows > 200) {
            throw new ValidationError('rows must be a number between 1 and 200');
          }
        },
      },

      AI_COMPLETION_REQUEST: {
        required: ['type', 'userId', 'sessionId', 'context'],
        optional: ['provider', 'model', 'maxTokens', 'temperature', 'instruction', 'useCache'],
        validate: (msg) => {
          if (typeof msg.userId !== 'string' || msg.userId.trim() === '') {
            throw new ValidationError('userId must be a non-empty string');
          }
          if (typeof msg.sessionId !== 'string' || msg.sessionId.trim() === '') {
            throw new ValidationError('sessionId must be a non-empty string');
          }
          if (!msg.context || typeof msg.context !== 'object') {
            throw new ValidationError('context must be an object');
          }
          if (
            msg.maxTokens &&
            (typeof msg.maxTokens !== 'number' || msg.maxTokens <= 0 || msg.maxTokens > 8000)
          ) {
            throw new ValidationError('maxTokens must be a number between 1 and 8000');
          }
          if (
            msg.temperature &&
            (typeof msg.temperature !== 'number' || msg.temperature < 0 || msg.temperature > 2)
          ) {
            throw new ValidationError('temperature must be a number between 0 and 2');
          }
          if (msg.instruction && typeof msg.instruction !== 'string') {
            throw new ValidationError('instruction must be a string');
          }
        },
      },

      AI_COMPLETION_CANCEL: {
        required: ['type', 'userId', 'sessionId'],
        optional: [],
        validate: (msg) => {
          if (typeof msg.userId !== 'string' || msg.userId.trim() === '') {
            throw new ValidationError('userId must be a non-empty string');
          }
          if (typeof msg.sessionId !== 'string' || msg.sessionId.trim() === '') {
            throw new ValidationError('sessionId must be a non-empty string');
          }
        },
      },

      AI_EXPLAIN_REQUEST: {
        required: ['type', 'userId', 'sessionId', 'code'],
        optional: ['language'],
        validate: (msg) => {
          if (typeof msg.userId !== 'string' || msg.userId.trim() === '') {
            throw new ValidationError('userId must be a non-empty string');
          }
          if (typeof msg.sessionId !== 'string' || msg.sessionId.trim() === '') {
            throw new ValidationError('sessionId must be a non-empty string');
          }
          if (typeof msg.code !== 'string' || msg.code.trim() === '') {
            throw new ValidationError('code must be a non-empty string');
          }
          if (msg.code.length > 50000) {
            throw new ValidationError('code must be <= 50000 characters');
          }
          if (msg.language && typeof msg.language !== 'string') {
            throw new ValidationError('language must be a string');
          }
        },
      },

      AI_REFACTOR_REQUEST: {
        required: ['type', 'userId', 'sessionId', 'code'],
        optional: ['language', 'refactorType'],
        validate: (msg) => {
          if (typeof msg.userId !== 'string' || msg.userId.trim() === '') {
            throw new ValidationError('userId must be a non-empty string');
          }
          if (typeof msg.sessionId !== 'string' || msg.sessionId.trim() === '') {
            throw new ValidationError('sessionId must be a non-empty string');
          }
          if (typeof msg.code !== 'string' || msg.code.trim() === '') {
            throw new ValidationError('code must be a non-empty string');
          }
          if (msg.code.length > 50000) {
            throw new ValidationError('code must be <= 50000 characters');
          }
          if (msg.language && typeof msg.language !== 'string') {
            throw new ValidationError('language must be a string');
          }
          if (
            msg.refactorType &&
            !['improve', 'optimize', 'modernize', 'simplify'].includes(msg.refactorType)
          ) {
            throw new ValidationError(
              'refactorType must be one of: improve, optimize, modernize, simplify'
            );
          }
        },
      },

      AI_FEEDBACK: {
        required: ['type', 'requestId', 'helpful'],
        optional: ['userId', 'rating', 'comment'],
        validate: (msg) => {
          if (typeof msg.requestId !== 'string' || msg.requestId.trim() === '') {
            throw new ValidationError('requestId must be a non-empty string');
          }
          if (typeof msg.helpful !== 'boolean') {
            throw new ValidationError('helpful must be a boolean');
          }
          if (msg.userId && typeof msg.userId !== 'string') {
            throw new ValidationError('userId must be a string');
          }
          if (msg.rating && (typeof msg.rating !== 'number' || msg.rating < 1 || msg.rating > 5)) {
            throw new ValidationError('rating must be a number between 1 and 5');
          }
          if (msg.comment && typeof msg.comment !== 'string') {
            throw new ValidationError('comment must be a string');
          }
        },
      },
    };
  }

  validate(message) {
    if (!message || typeof message !== 'object') {
      throw new ValidationError('Message must be an object');
    }

    if (!message.type || typeof message.type !== 'string') {
      throw new ValidationError('Message type is required');
    }

    if (!Object.values(MessageTypes).includes(message.type)) {
      throw new ValidationError(
        `Unknown message type: ${message.type}. Valid types: ${Object.values(MessageTypes).join(
          ', '
        )}`
      );
    }

    const schema = this.schemas[message.type];
    if (!schema) {
      throw new ValidationError(`No schema found for message type: ${message.type}`);
    }

    // Check required fields
    for (const field of schema.required) {
      if (!(field in message)) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }

    // Run custom validation
    if (schema.validate) {
      schema.validate(message);
    }

    return {
      valid: true,
      type: message.type,
      message,
    };
  }

  buildMessage(type, data) {
    if (!Object.values(MessageTypes).includes(type)) {
      throw new ValidationError(`Unknown message type: ${type}`);
    }

    return {
      type,
      ...data,
    };
  }

  buildErrorMessage(error, roomId = null, clientId = null) {
    const code = error.code || 'UNKNOWN_ERROR';
    const message = error.message || 'An error occurred';

    return this.buildMessage(MessageTypes.ERROR, {
      code,
      message,
      roomId,
      clientId,
      timestamp: Date.now(),
    });
  }

  buildAckMessage(roomId, clientId, operationId, version) {
    return this.buildMessage(MessageTypes.ACK, {
      roomId,
      clientId,
      operationId,
      version,
      timestamp: Date.now(),
    });
  }
}

module.exports = {
  MessageValidator,
  MessageTypes,
  ValidationError,
};
