const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

class TerminalSessionService {
  constructor() {
    this.sessions = new Map();
    this.sessionTimeouts = new Map();
    this.maxIdleTimeout = 30 * 60 * 1000; // 30 minutes
    this.maxSessions = 100;
  }

  createSession(options) {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Maximum number of sessions (${this.maxSessions}) reached`);
    }

    const sessionId = uuidv4();
    const session = {
      id: sessionId,
      userId: options.userId,
      roomId: options.roomId,
      language: options.language,
      mode: options.mode || 'local',
      file: options.file,
      isRepl: options.isRepl || false,
      status: 'creating',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      executor: null,
      metadata: options.metadata || {},
    };

    this.sessions.set(sessionId, session);
    this.resetIdleTimeout(sessionId);

    logger.info(`Terminal session created`, {
      sessionId,
      userId: options.userId,
      language: options.language,
      mode: options.mode,
    });

    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    Object.assign(session, updates, { lastActivityAt: new Date() });
    this.resetIdleTimeout(sessionId);

    return session;
  }

  setExecutor(sessionId, executor) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.executor = executor;
    session.status = 'running';
    session.lastActivityAt = new Date();
    this.resetIdleTimeout(sessionId);
  }

  async destroySession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.clearIdleTimeout(sessionId);

    if (session.executor && typeof session.executor.cleanup === 'function') {
      try {
        await session.executor.cleanup();
      } catch (error) {
        logger.error(`Error cleaning up executor for session ${sessionId}:`, error);
      }
    }

    session.status = 'terminated';
    this.sessions.delete(sessionId);

    logger.info(`Terminal session destroyed`, {
      sessionId,
      userId: session.userId,
    });
  }

  getUserSessions(userId) {
    return Array.from(this.sessions.values()).filter((session) => session.userId === userId);
  }

  getRoomSessions(roomId) {
    return Array.from(this.sessions.values()).filter((session) => session.roomId === roomId);
  }

  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  resetIdleTimeout(sessionId) {
    this.clearIdleTimeout(sessionId);

    const timeout = setTimeout(() => {
      logger.info(`Session ${sessionId} idle timeout reached, destroying`);
      this.destroySession(sessionId);
    }, this.maxIdleTimeout);

    this.sessionTimeouts.set(sessionId, timeout);
  }

  clearIdleTimeout(sessionId) {
    const timeout = this.sessionTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.sessionTimeouts.delete(sessionId);
    }
  }

  async cleanupAll() {
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.destroySession(sessionId);
    }
  }

  getStats() {
    const sessions = Array.from(this.sessions.values());
    const byMode = sessions.reduce((acc, session) => {
      acc[session.mode] = (acc[session.mode] || 0) + 1;
      return acc;
    }, {});

    const byLanguage = sessions.reduce((acc, session) => {
      acc[session.language] = (acc[session.language] || 0) + 1;
      return acc;
    }, {});

    return {
      total: sessions.length,
      byMode,
      byLanguage,
      maxSessions: this.maxSessions,
    };
  }
}

module.exports = new TerminalSessionService();
