const logger = require('../utils/logger');
const terminalSessionService = require('./terminal-session.service');
const terminalSchedulerService = require('./terminal-scheduler.service');
const languageRuntimeService = require('./language-runtime.service');

class TerminalOrchestratorService {
  constructor() {
    this.commandSanitizer = {
      maxLength: 10000,
      blockedPatterns: [/rm\s+-rf\s+\/(?!tmp|home)/, /mkfs/, /dd\s+if=/, /:\(\)\{\s*:\|:&\s*\};:/],
    };
  }

  sanitizeInput(input) {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }

    if (input.length > this.commandSanitizer.maxLength) {
      throw new Error(`Input exceeds maximum length of ${this.commandSanitizer.maxLength}`);
    }

    for (const pattern of this.commandSanitizer.blockedPatterns) {
      if (pattern.test(input)) {
        throw new Error('Input contains blocked pattern');
      }
    }

    return input;
  }

  async createTerminalSession(options) {
    const {
      userId,
      roomId,
      language,
      file,
      workspaceDir,
      isRepl = false,
      mode = 'auto',
      useContainer = true,
      env = {},
      metadata = {},
    } = options;

    languageRuntimeService.validateLanguage(language);

    const session = terminalSessionService.createSession({
      userId,
      roomId,
      language,
      file,
      isRepl,
      mode,
      metadata,
    });

    try {
      const result = await terminalSchedulerService.scheduleExecution(session.id, {
        language,
        file,
        workspaceDir,
        isRepl,
        mode,
        useContainer,
        env,
      });

      terminalSessionService.setExecutor(session.id, result.executor);
      terminalSessionService.updateSession(session.id, {
        mode: result.mode,
        status: 'running',
      });

      logger.info(`Terminal session ${session.id} started successfully`, {
        mode: result.mode,
        type: result.type,
      });

      return {
        sessionId: session.id,
        mode: result.mode,
        type: result.type,
        language,
        status: 'running',
      };
    } catch (error) {
      terminalSessionService.updateSession(session.id, {
        status: 'failed',
        error: error.message,
      });
      await terminalSessionService.destroySession(session.id);
      throw error;
    }
  }

  async sendInput(sessionId, data) {
    const session = terminalSessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'running') {
      throw new Error(`Session is not running: ${sessionId}`);
    }

    const sanitizedData = this.sanitizeInput(data);

    const executor = session.executor;
    if (executor && executor.write) {
      executor.write(sanitizedData);
      terminalSessionService.updateSession(sessionId, {});
    } else {
      throw new Error(`Executor not available for session: ${sessionId}`);
    }
  }

  async resizeTerminal(sessionId, cols, rows) {
    const session = terminalSessionService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const executor = session.executor;
    if (executor && executor.resize) {
      await executor.resize(cols, rows);
      terminalSessionService.updateSession(sessionId, {});
      logger.debug(`Terminal ${sessionId} resized to ${cols}x${rows}`);
    }
  }

  async terminateSession(sessionId) {
    const session = terminalSessionService.getSession(sessionId);
    if (!session) {
      return;
    }

    logger.info(`Terminating terminal session ${sessionId}`);
    await terminalSessionService.destroySession(sessionId);
  }

  getSession(sessionId) {
    return terminalSessionService.getSession(sessionId);
  }

  getUserSessions(userId) {
    return terminalSessionService.getUserSessions(userId);
  }

  getRoomSessions(roomId) {
    return terminalSessionService.getRoomSessions(roomId);
  }

  getCapabilityMatrix() {
    return terminalSchedulerService.getCapabilityMatrix();
  }

  getStats() {
    return {
      sessions: terminalSessionService.getStats(),
      capability: terminalSchedulerService.getCapabilityMatrix(),
    };
  }

  async cleanup() {
    logger.info('Cleaning up all terminal sessions');
    await terminalSessionService.cleanupAll();
  }
}

module.exports = new TerminalOrchestratorService();
