const logger = require('../utils/logger');
const { otOperationLatency, otOperationTotal, otQueueDepth } = require('../utils/metrics');

class OperationalTransformationService {
  constructor() {
    this.documentStates = new Map(); // roomId -> DocumentState
  }

  createDocumentState(roomId, initialContent = '') {
    const state = {
      roomId,
      version: 0,
      content: initialContent,
      operationHistory: [],
      pendingOperations: new Map(), // clientId -> [operations]
      appliedOperations: new Map(), // clientId -> lastAppliedVersion
      metadata: {
        lastModified: Date.now(),
        modifiedBy: null,
      },
    };
    this.documentStates.set(roomId, state);
    return state;
  }

  getDocumentState(roomId) {
    if (!this.documentStates.has(roomId)) {
      return this.createDocumentState(roomId);
    }
    return this.documentStates.get(roomId);
  }

  applyOperation(roomId, operation) {
    const startTime = Date.now();
    const state = this.getDocumentState(roomId);

    try {
      // Transform operation against pending operations if needed
      const transformedOp = this.transformOperation(operation, state, operation.clientId);

      // Apply the operation to the document content
      this.applyOperationToContent(state, transformedOp);

      // Record in history
      state.operationHistory.push(transformedOp);
      state.version += 1;
      state.metadata.lastModified = Date.now();
      state.metadata.modifiedBy = operation.userId;

      // Track applied operation for this client
      if (!state.appliedOperations.has(operation.clientId)) {
        state.appliedOperations.set(operation.clientId, 0);
      }

      // Record metrics
      const latency = Date.now() - startTime;
      otOperationLatency.observe(latency);
      otOperationTotal.inc({ type: operation.type, status: 'applied' });

      logger.debug('Operation applied', {
        roomId,
        operationId: operation.id,
        version: state.version,
        latency,
      });

      return {
        success: true,
        version: state.version,
        operation: transformedOp,
        content: state.content,
      };
    } catch (error) {
      logger.error('Error applying operation', { roomId, error });
      otOperationTotal.inc({ type: operation.type, status: 'failed' });
      throw error;
    }
  }

  transformOperation(operation, state, clientId) {
    // For operations from the same client, no transformation needed
    if (!state.pendingOperations.has(clientId)) {
      state.pendingOperations.set(clientId, []);
    }

    let transformedOp = { ...operation };

    // Transform against pending operations from other clients
    for (const [otherId, ops] of state.pendingOperations) {
      if (otherId === clientId) continue;

      for (const otherOp of ops) {
        transformedOp = this.transformAgainstOperation(transformedOp, otherOp);
      }
    }

    // Track pending operation
    state.pendingOperations.get(clientId).push(transformedOp);

    return transformedOp;
  }

  transformAgainstOperation(op1, op2) {
    // Operational Transformation algorithm
    // This is a simplified implementation supporting insert/delete operations

    const transformed = { ...op1 };

    // Both operations at the same position - resolve by client ID
    if (op1.position === op2.position) {
      if (op1.clientId < op2.clientId) {
        return transformed; // op1 has priority, no change needed
      }
      // Adjust op1 position based on op2
      if (op2.type === 'insert') {
        transformed.position += op2.content.length;
      } else if (op2.type === 'delete') {
        transformed.position = Math.max(0, transformed.position - op2.content.length);
      }
      return transformed;
    }

    // op1 is after op2
    if (op1.position > op2.position) {
      if (op2.type === 'insert') {
        transformed.position += op2.content.length;
      } else if (op2.type === 'delete') {
        transformed.position = Math.max(op2.position, transformed.position - op2.content.length);
      }
    }

    // op1 is before op2 - no adjustment needed for position
    return transformed;
  }

  applyOperationToContent(state, operation) {
    const { type, position, content } = operation;

    if (type === 'insert') {
      state.content = state.content.slice(0, position) + content + state.content.slice(position);
    } else if (type === 'delete') {
      state.content =
        state.content.slice(0, position) + state.content.slice(position + content.length);
    }
  }

  acknowledgeOperation(roomId, clientId, operationId) {
    const state = this.getDocumentState(roomId);

    if (!state.pendingOperations.has(clientId)) {
      return;
    }

    const ops = state.pendingOperations.get(clientId);
    const opIndex = ops.findIndex((op) => op.id === operationId);

    if (opIndex !== -1) {
      ops[opIndex].acked = true;

      // Remove acknowledged operations from the front
      while (ops.length > 0 && ops[0].acked) {
        ops.shift();
      }

      otOperationTotal.inc({ type: 'ack', status: 'received' });
    }
  }

  getOperationsSince(roomId, clientId, version) {
    const state = this.getDocumentState(roomId);
    const operations = [];

    for (let i = version; i < state.operationHistory.length; i++) {
      const op = state.operationHistory[i];
      // Don't send back operations from the same client
      if (op.clientId !== clientId) {
        operations.push(op);
      }
    }

    return operations;
  }

  getSnapshot(roomId) {
    const state = this.getDocumentState(roomId);
    return {
      version: state.version,
      content: state.content,
      metadata: state.metadata,
    };
  }

  cleanupRoom(roomId) {
    const state = this.documentStates.get(roomId);
    if (state) {
      logger.info('Cleaning up OT state for room', { roomId });
      this.documentStates.delete(roomId);
    }
  }

  getQueueStats(roomId) {
    const state = this.getDocumentState(roomId);
    let totalPending = 0;
    let queueLength = 0;

    for (const [, ops] of state.pendingOperations) {
      const pendingOps = ops.filter((op) => !op.acked);
      totalPending += pendingOps.length;
      queueLength = Math.max(queueLength, pendingOps.length);
    }

    otQueueDepth.set(queueLength);
    return {
      totalPending,
      maxQueueLength: queueLength,
      clientCount: state.pendingOperations.size,
    };
  }
}

module.exports = new OperationalTransformationService();
