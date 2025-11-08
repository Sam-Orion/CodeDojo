const mongoose = require('mongoose');
const logger = require('../utils/logger');

// Schema for operation history
const operationHistorySchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    operationId: {
      type: String,
      required: true,
      unique: true,
    },
    clientId: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    version: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ['insert', 'delete'],
      required: true,
    },
    position: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
      expires: 30 * 24 * 60 * 60, // TTL: 30 days
    },
  },
  { timestamps: false }
);

operationHistorySchema.index({ roomId: 1, version: 1 });
operationHistorySchema.index({ roomId: 1, timestamp: 1 });

// Schema for document snapshots
const snapshotSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
    },
    version: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    metadata: {
      lastModified: Date,
      modifiedBy: mongoose.Schema.Types.ObjectId,
      contentLength: Number,
      lineCount: Number,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
      expires: 60 * 24 * 60 * 60, // TTL: 60 days
    },
  },
  { timestamps: false }
);

// Schema for cursor state
const cursorStateSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clientId: {
      type: String,
      required: true,
    },
    cursor: {
      line: Number,
      column: Number,
    },
    lastUpdate: {
      type: Date,
      default: Date.now,
      expires: 7 * 24 * 60 * 60, // TTL: 7 days
    },
  },
  { timestamps: false }
);

cursorStateSchema.index({ roomId: 1, userId: 1 });
cursorStateSchema.index({ roomId: 1, clientId: 1 });

let OperationHistory;
let Snapshot;
let CursorState;

try {
  OperationHistory = mongoose.model('OperationHistory', operationHistorySchema);
} catch (e) {
  OperationHistory = mongoose.model('OperationHistory');
}

try {
  Snapshot = mongoose.model('Snapshot', snapshotSchema);
} catch (e) {
  Snapshot = mongoose.model('Snapshot');
}

try {
  CursorState = mongoose.model('CursorState', cursorStateSchema);
} catch (e) {
  CursorState = mongoose.model('CursorState');
}

class PersistenceService {
  async saveOperation(roomId, operation) {
    try {
      const doc = new OperationHistory({
        roomId,
        operationId: operation.id,
        clientId: operation.clientId,
        userId: operation.userId,
        version: operation.version,
        type: operation.type,
        position: operation.position,
        content: operation.content,
        timestamp: new Date(operation.timestamp),
      });

      await doc.save();
      logger.debug('Operation saved', { roomId, operationId: operation.id });
      return { success: true };
    } catch (error) {
      logger.error('Error saving operation', { roomId, error });
      throw error;
    }
  }

  async saveSnapshot(roomId, version, content, metadata = {}, documentId = null) {
    try {
      const snapshot = await Snapshot.findOneAndUpdate(
        { roomId },
        {
          roomId,
          documentId,
          version,
          content,
          metadata: {
            lastModified: metadata.lastModified || Date.now(),
            modifiedBy: metadata.modifiedBy,
            contentLength: content.length,
            lineCount: content.split('\n').length,
          },
        },
        { upsert: true, new: true }
      );

      logger.debug('Snapshot saved', { roomId, version });
      return { success: true, snapshot };
    } catch (error) {
      logger.error('Error saving snapshot', { roomId, error });
      throw error;
    }
  }

  async getSnapshot(roomId) {
    try {
      const snapshot = await Snapshot.findOne({ roomId });
      if (snapshot) {
        logger.debug('Snapshot retrieved', { roomId, version: snapshot.version });
        return snapshot;
      }
      return null;
    } catch (error) {
      logger.error('Error retrieving snapshot', { roomId, error });
      throw error;
    }
  }

  async getOperationsSince(roomId, version) {
    try {
      const operations = await OperationHistory.find({
        roomId,
        version: { $gt: version },
      })
        .sort({ version: 1 })
        .exec();

      logger.debug('Operations retrieved', {
        roomId,
        fromVersion: version,
        count: operations.length,
      });

      return operations;
    } catch (error) {
      logger.error('Error retrieving operations', { roomId, error });
      throw error;
    }
  }

  async getOperationsInRange(roomId, fromVersion, toVersion) {
    try {
      const operations = await OperationHistory.find({
        roomId,
        version: { $gte: fromVersion, $lte: toVersion },
      })
        .sort({ version: 1 })
        .exec();

      return operations;
    } catch (error) {
      logger.error('Error retrieving operations in range', { roomId, error });
      throw error;
    }
  }

  async saveCursorState(roomId, userId, clientId, cursor) {
    try {
      const state = await CursorState.findOneAndUpdate(
        { roomId, userId },
        {
          roomId,
          userId,
          clientId,
          cursor,
          lastUpdate: new Date(),
        },
        { upsert: true, new: true }
      );

      logger.debug('Cursor state saved', { roomId, userId });
      return { success: true, state };
    } catch (error) {
      logger.error('Error saving cursor state', { roomId, error });
      throw error;
    }
  }

  async getCursorStates(roomId) {
    try {
      const states = await CursorState.find({ roomId }).exec();
      return states;
    } catch (error) {
      logger.error('Error retrieving cursor states', { roomId, error });
      throw error;
    }
  }

  async deleteRoomData(roomId) {
    try {
      await Promise.all([
        Snapshot.deleteOne({ roomId }),
        CursorState.deleteMany({ roomId }),
        OperationHistory.deleteMany({ roomId }),
      ]);

      logger.info('Room data deleted', { roomId });
      return { success: true };
    } catch (error) {
      logger.error('Error deleting room data', { roomId, error });
      throw error;
    }
  }

  async archiveRoom(roomId) {
    try {
      const snapshot = await this.getSnapshot(roomId);
      const operations = await OperationHistory.find({ roomId }).exec();

      const archive = {
        roomId,
        archivedAt: new Date(),
        snapshot,
        operationCount: operations.length,
      };

      logger.info('Room archived', { roomId, operationCount: operations.length });
      return archive;
    } catch (error) {
      logger.error('Error archiving room', { roomId, error });
      throw error;
    }
  }

  async getStats(roomId) {
    try {
      const [snapshot, operationCount, cursorStateCount] = await Promise.all([
        this.getSnapshot(roomId),
        OperationHistory.countDocuments({ roomId }),
        CursorState.countDocuments({ roomId }),
      ]);

      return {
        roomId,
        snapshotVersion: snapshot?.version || 0,
        snapshotSize: snapshot?.content.length || 0,
        operationCount,
        cursorStateCount,
      };
    } catch (error) {
      logger.error('Error getting stats', { roomId, error });
      throw error;
    }
  }
}

module.exports = new PersistenceService();
