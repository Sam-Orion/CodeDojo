const TerminalAuditLog = require('../models/TerminalAuditLog');
const logger = require('../utils/logger');

class TerminalAuditService {
  async logCreate(session) {
    try {
      await TerminalAuditLog.create({
        sessionId: session.id,
        userId: session.userId,
        roomId: session.roomId,
        action: 'CREATE',
        language: session.language,
        mode: session.mode,
        executorType: session.executor?.type,
        metadata: session.metadata,
      });
    } catch (error) {
      logger.error('Failed to log terminal create:', error);
    }
  }

  async logInput(sessionId, userId, data) {
    try {
      const session = await this.getSessionInfo(sessionId);
      await TerminalAuditLog.create({
        sessionId,
        userId,
        roomId: session?.roomId,
        action: 'INPUT',
        language: session?.language || 'unknown',
        mode: session?.mode || 'unknown',
        data: data.substring(0, 1000),
      });
    } catch (error) {
      logger.error('Failed to log terminal input:', error);
    }
  }

  async logOutput(sessionId, userId, data) {
    try {
      const session = await this.getSessionInfo(sessionId);
      await TerminalAuditLog.create({
        sessionId,
        userId,
        roomId: session?.roomId,
        action: 'OUTPUT',
        language: session?.language || 'unknown',
        mode: session?.mode || 'unknown',
        data: data.substring(0, 1000),
      });
    } catch (error) {
      logger.error('Failed to log terminal output:', error);
    }
  }

  async logExit(sessionId, userId, exitCode) {
    try {
      const session = await this.getSessionInfo(sessionId);
      await TerminalAuditLog.create({
        sessionId,
        userId,
        roomId: session?.roomId,
        action: 'EXIT',
        language: session?.language || 'unknown',
        mode: session?.mode || 'unknown',
        exitCode,
      });
    } catch (error) {
      logger.error('Failed to log terminal exit:', error);
    }
  }

  async logError(sessionId, userId, error) {
    try {
      const session = await this.getSessionInfo(sessionId);
      await TerminalAuditLog.create({
        sessionId,
        userId,
        roomId: session?.roomId,
        action: 'ERROR',
        language: session?.language || 'unknown',
        mode: session?.mode || 'unknown',
        error: error.message || String(error),
      });
    } catch (error) {
      logger.error('Failed to log terminal error:', error);
    }
  }

  async logTerminate(sessionId, userId) {
    try {
      const session = await this.getSessionInfo(sessionId);
      await TerminalAuditLog.create({
        sessionId,
        userId,
        roomId: session?.roomId,
        action: 'TERMINATE',
        language: session?.language || 'unknown',
        mode: session?.mode || 'unknown',
      });
    } catch (error) {
      logger.error('Failed to log terminal terminate:', error);
    }
  }

  async getSessionLogs(sessionId, limit = 100) {
    try {
      return await TerminalAuditLog.find({ sessionId }).sort({ createdAt: -1 }).limit(limit).lean();
    } catch (error) {
      logger.error('Failed to get session logs:', error);
      return [];
    }
  }

  async getUserLogs(userId, limit = 100) {
    try {
      return await TerminalAuditLog.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
    } catch (error) {
      logger.error('Failed to get user logs:', error);
      return [];
    }
  }

  getSessionInfo(sessionId) {
    return {
      sessionId,
      language: 'unknown',
      mode: 'unknown',
    };
  }
}

module.exports = new TerminalAuditService();
