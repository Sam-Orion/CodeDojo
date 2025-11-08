const assert = require('assert');
const { describe, it, beforeEach } = require('mocha');
const {
  MessageValidator,
  MessageTypes,
  ValidationError,
} = require('../src/services/message-validator.service');

describe('Message Validator Service', () => {
  let validator;

  beforeEach(() => {
    validator = new MessageValidator();
  });

  describe('Message Validation', () => {
    it('should reject non-object messages', () => {
      assert.throws(() => {
        validator.validate('not an object');
      }, ValidationError);
    });

    it('should reject messages without type', () => {
      assert.throws(() => {
        validator.validate({ roomId: 'test' });
      }, ValidationError);
    });

    it('should reject messages with unknown type', () => {
      assert.throws(() => {
        validator.validate({ type: 'UNKNOWN_TYPE' });
      }, ValidationError);
    });
  });

  describe('JOIN_ROOM Validation', () => {
    it('should validate valid JOIN_ROOM message', () => {
      const msg = {
        type: MessageTypes.JOIN_ROOM,
        roomId: 'room-123',
        userId: 'user-456',
        clientId: 'client-789',
      };

      const result = validator.validate(msg);

      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.type, MessageTypes.JOIN_ROOM);
    });

    it('should require roomId', () => {
      const msg = {
        type: MessageTypes.JOIN_ROOM,
        userId: 'user-456',
        clientId: 'client-789',
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });

    it('should require userId', () => {
      const msg = {
        type: MessageTypes.JOIN_ROOM,
        roomId: 'room-123',
        clientId: 'client-789',
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });

    it('should require clientId', () => {
      const msg = {
        type: MessageTypes.JOIN_ROOM,
        roomId: 'room-123',
        userId: 'user-456',
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });

    it('should reject empty roomId', () => {
      const msg = {
        type: MessageTypes.JOIN_ROOM,
        roomId: '',
        userId: 'user-456',
        clientId: 'client-789',
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });

    it('should reject roomId exceeding max length', () => {
      const msg = {
        type: MessageTypes.JOIN_ROOM,
        roomId: 'a'.repeat(101),
        userId: 'user-456',
        clientId: 'client-789',
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });
  });

  describe('OT_OP Validation', () => {
    it('should validate valid OT_OP message', () => {
      const msg = {
        type: MessageTypes.OT_OP,
        roomId: 'room-123',
        clientId: 'client-789',
        operation: {
          id: 'op-001',
          version: 0,
          type: 'insert',
          position: 0,
          content: 'Hello',
        },
      };

      const result = validator.validate(msg);

      assert.strictEqual(result.valid, true);
    });

    it('should require operation object', () => {
      const msg = {
        type: MessageTypes.OT_OP,
        roomId: 'room-123',
        clientId: 'client-789',
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });

    it('should validate operation.type is insert or delete', () => {
      const msg = {
        type: MessageTypes.OT_OP,
        roomId: 'room-123',
        clientId: 'client-789',
        operation: {
          id: 'op-001',
          version: 0,
          type: 'invalid',
          position: 0,
          content: 'Hello',
        },
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });

    it('should validate operation.version is non-negative', () => {
      const msg = {
        type: MessageTypes.OT_OP,
        roomId: 'room-123',
        clientId: 'client-789',
        operation: {
          id: 'op-001',
          version: -1,
          type: 'insert',
          position: 0,
          content: 'Hello',
        },
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });

    it('should validate operation.position is non-negative', () => {
      const msg = {
        type: MessageTypes.OT_OP,
        roomId: 'room-123',
        clientId: 'client-789',
        operation: {
          id: 'op-001',
          version: 0,
          type: 'insert',
          position: -1,
          content: 'Hello',
        },
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });

    it('should validate content length', () => {
      const msg = {
        type: MessageTypes.OT_OP,
        roomId: 'room-123',
        clientId: 'client-789',
        operation: {
          id: 'op-001',
          version: 0,
          type: 'insert',
          position: 0,
          content: 'a'.repeat(10001),
        },
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });
  });

  describe('CURSOR_UPDATE Validation', () => {
    it('should validate valid CURSOR_UPDATE message', () => {
      const msg = {
        type: MessageTypes.CURSOR_UPDATE,
        roomId: 'room-123',
        clientId: 'client-789',
        cursor: {
          line: 5,
          column: 10,
        },
      };

      const result = validator.validate(msg);

      assert.strictEqual(result.valid, true);
    });

    it('should validate cursor is an object', () => {
      const msg = {
        type: MessageTypes.CURSOR_UPDATE,
        roomId: 'room-123',
        clientId: 'client-789',
        cursor: 'invalid',
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });

    it('should validate cursor.line is non-negative number', () => {
      const msg = {
        type: MessageTypes.CURSOR_UPDATE,
        roomId: 'room-123',
        clientId: 'client-789',
        cursor: {
          line: -1,
          column: 10,
        },
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });

    it('should validate cursor.column is non-negative number', () => {
      const msg = {
        type: MessageTypes.CURSOR_UPDATE,
        roomId: 'room-123',
        clientId: 'client-789',
        cursor: {
          line: 5,
          column: -1,
        },
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });
  });

  describe('SYNC_STATE Validation', () => {
    it('should validate valid SYNC_STATE message', () => {
      const msg = {
        type: MessageTypes.SYNC_STATE,
        roomId: 'room-123',
        clientId: 'client-789',
        fromVersion: 5,
      };

      const result = validator.validate(msg);

      assert.strictEqual(result.valid, true);
    });

    it('should allow missing fromVersion', () => {
      const msg = {
        type: MessageTypes.SYNC_STATE,
        roomId: 'room-123',
        clientId: 'client-789',
      };

      const result = validator.validate(msg);

      assert.strictEqual(result.valid, true);
    });

    it('should validate fromVersion is non-negative', () => {
      const msg = {
        type: MessageTypes.SYNC_STATE,
        roomId: 'room-123',
        clientId: 'client-789',
        fromVersion: -1,
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });
  });

  describe('ACK Validation', () => {
    it('should validate valid ACK message', () => {
      const msg = {
        type: MessageTypes.ACK,
        roomId: 'room-123',
        clientId: 'client-789',
        operationId: 'op-001',
      };

      const result = validator.validate(msg);

      assert.strictEqual(result.valid, true);
    });

    it('should require operationId', () => {
      const msg = {
        type: MessageTypes.ACK,
        roomId: 'room-123',
        clientId: 'client-789',
      };

      assert.throws(() => {
        validator.validate(msg);
      }, ValidationError);
    });
  });

  describe('Message Building', () => {
    it('should build error message', () => {
      const error = new Error('Test error');
      const msg = validator.buildErrorMessage(error, 'room-123', 'client-789');

      assert.strictEqual(msg.type, MessageTypes.ERROR);
      assert(msg.message);
      assert.strictEqual(msg.roomId, 'room-123');
      assert.strictEqual(msg.clientId, 'client-789');
    });

    it('should build ack message', () => {
      const msg = validator.buildAckMessage('room-123', 'client-789', 'op-001', 5);

      assert.strictEqual(msg.type, MessageTypes.ACK);
      assert.strictEqual(msg.operationId, 'op-001');
      assert.strictEqual(msg.version, 5);
    });

    it('should build generic message', () => {
      const msg = validator.buildMessage(MessageTypes.JOIN_ROOM, {
        roomId: 'room-123',
        clientId: 'client-789',
      });

      assert.strictEqual(msg.type, MessageTypes.JOIN_ROOM);
      assert.strictEqual(msg.roomId, 'room-123');
    });
  });
});
