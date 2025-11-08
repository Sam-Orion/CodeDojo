const logger = require('../utils/logger');
const localExecutorService = require('./local-executor.service');
const cloudExecutorService = require('./cloud-executor.service');
const languageRuntimeService = require('./language-runtime.service');

class TerminalSchedulerService {
  constructor() {
    this.localResourceThresholds = {
      maxContainers: 20,
      maxPtyProcesses: 50,
    };

    this.strategy = {
      preferLocal: true,
      cloudFallback: true,
      loadBalancing: false,
    };
  }

  async scheduleExecution(sessionId, options) {
    const { mode, language } = options;

    languageRuntimeService.validateLanguage(language);

    if (mode === 'cloud') {
      return await this.executeCloud(sessionId, options);
    } else if (mode === 'local') {
      return await this.executeLocal(sessionId, options);
    } else {
      return await this.executeAuto(sessionId, options);
    }
  }

  async executeLocal(sessionId, options) {
    const { useContainer = true } = options;

    try {
      logger.info(`Scheduling local execution for session ${sessionId}`, {
        useContainer,
      });

      const executor = await localExecutorService.execute(sessionId, options);
      return {
        executor,
        mode: 'local',
        type: executor.type,
      };
    } catch (error) {
      logger.error(`Local execution failed for session ${sessionId}:`, error);
      throw error;
    }
  }

  async executeCloud(sessionId, options) {
    if (!cloudExecutorService.isCloudAvailable()) {
      throw new Error('No cloud providers available');
    }

    try {
      logger.info(`Scheduling cloud execution for session ${sessionId}`);

      const executor = await cloudExecutorService.execute(sessionId, options);
      return {
        executor,
        mode: 'cloud',
        type: executor.type,
      };
    } catch (error) {
      logger.error(`Cloud execution failed for session ${sessionId}:`, error);
      throw error;
    }
  }

  async executeAuto(sessionId, options) {
    const localStats = localExecutorService.getStats();

    const shouldUseLocal =
      this.strategy.preferLocal &&
      localStats.activeContainers < this.localResourceThresholds.maxContainers &&
      localStats.activePtyProcesses < this.localResourceThresholds.maxPtyProcesses;

    if (shouldUseLocal) {
      try {
        return await this.executeLocal(sessionId, options);
      } catch (error) {
        logger.warn(`Local execution failed, attempting cloud fallback:`, error.message);

        if (this.strategy.cloudFallback && cloudExecutorService.isCloudAvailable()) {
          return await this.executeCloud(sessionId, options);
        }

        throw error;
      }
    } else {
      if (cloudExecutorService.isCloudAvailable()) {
        try {
          return await this.executeCloud(sessionId, options);
        } catch (error) {
          logger.warn(`Cloud execution failed, attempting local fallback:`, error.message);
          return await this.executeLocal(sessionId, options);
        }
      } else {
        return await this.executeLocal(sessionId, options);
      }
    }
  }

  getCapabilityMatrix() {
    const languages = languageRuntimeService.getCapabilityMatrix();
    const cloudProviders = cloudExecutorService.getAvailableProviders();
    const localStats = localExecutorService.getStats();

    return {
      languages,
      executionModes: {
        local: {
          available: true,
          containerSupport: true,
          ptySupport: true,
          stats: localStats,
        },
        cloud: {
          available: cloudExecutorService.isCloudAvailable(),
          providers: cloudProviders,
          stats: cloudExecutorService.getStats(),
        },
      },
      resourceLimits: {
        local: this.localResourceThresholds,
      },
      strategy: this.strategy,
    };
  }

  updateStrategy(newStrategy) {
    this.strategy = { ...this.strategy, ...newStrategy };
    logger.info('Terminal scheduler strategy updated', { strategy: this.strategy });
  }

  getRecommendedMode() {
    const localStats = localExecutorService.getStats();
    const cloudAvailable = cloudExecutorService.isCloudAvailable();

    const localLoad =
      (localStats.activeContainers / this.localResourceThresholds.maxContainers +
        localStats.activePtyProcesses / this.localResourceThresholds.maxPtyProcesses) /
      2;

    if (localLoad < 0.7) {
      return 'local';
    } else if (cloudAvailable) {
      return 'cloud';
    } else {
      return 'local';
    }
  }
}

module.exports = new TerminalSchedulerService();
