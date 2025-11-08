const logger = require('../utils/logger');
const config = require('../config/env');
const GCPProvider = require('./cloud-providers/gcp.provider');
const AWSProvider = require('./cloud-providers/aws.provider');
const AzureProvider = require('./cloud-providers/azure.provider');

class CloudExecutorService {
  constructor() {
    this.providers = new Map();
    this.activeExecutions = new Map();
    this.initializeProviders();
  }

  initializeProviders() {
    const gcpConfig = {
      projectId: config.GCP_PROJECT_ID,
      region: config.GCP_REGION,
      enabled: !!config.GCP_PROJECT_ID,
    };
    const gcpProvider = new GCPProvider(gcpConfig);
    if (gcpProvider.isEnabled()) {
      this.providers.set('gcp', gcpProvider);
    }

    const awsConfig = {
      region: config.AWS_REGION,
      accessKeyId: config.AWS_ACCESS_KEY_ID,
      secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      enabled: !!(config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY),
      useLambda: config.AWS_USE_LAMBDA !== 'false',
    };
    const awsProvider = new AWSProvider(awsConfig);
    if (awsProvider.isEnabled()) {
      this.providers.set('aws', awsProvider);
    }

    const azureConfig = {
      subscriptionId: config.AZURE_SUBSCRIPTION_ID,
      resourceGroup: config.AZURE_RESOURCE_GROUP,
      location: config.AZURE_LOCATION,
      enabled: !!config.AZURE_SUBSCRIPTION_ID,
    };
    const azureProvider = new AzureProvider(azureConfig);
    if (azureProvider.isEnabled()) {
      this.providers.set('azure', azureProvider);
    }

    logger.info('Cloud executor initialized', {
      providers: Array.from(this.providers.keys()),
    });
  }

  async execute(sessionId, options) {
    const { provider = 'auto' } = options;

    let selectedProvider;

    if (provider === 'auto') {
      selectedProvider = this.selectProvider();
    } else {
      selectedProvider = this.providers.get(provider);
      if (!selectedProvider) {
        throw new Error(`Cloud provider not available: ${provider}`);
      }
    }

    if (!selectedProvider) {
      throw new Error('No cloud providers available');
    }

    try {
      logger.info(`Executing session ${sessionId} on cloud provider`, {
        provider: provider === 'auto' ? 'auto-selected' : provider,
      });

      const execution = await selectedProvider.execute(sessionId, options);
      this.activeExecutions.set(sessionId, {
        ...execution,
        provider: selectedProvider,
      });

      return execution;
    } catch (error) {
      if (error.message?.includes('quota') || error.message?.includes('limit')) {
        logger.warn(`Quota/limit error for provider, attempting failover`, {
          sessionId,
          error: error.message,
        });
        return await this.failoverExecution(sessionId, options, selectedProvider);
      }
      throw error;
    }
  }

  async failoverExecution(sessionId, options, failedProvider) {
    const availableProviders = Array.from(this.providers.values()).filter(
      (p) => p !== failedProvider
    );

    for (const provider of availableProviders) {
      try {
        logger.info(`Attempting failover for session ${sessionId}`);
        const execution = await provider.execute(sessionId, options);
        this.activeExecutions.set(sessionId, {
          ...execution,
          provider,
        });
        return execution;
      } catch (error) {
        logger.warn(`Failover attempt failed:`, error.message);
      }
    }

    throw new Error('All cloud providers failed');
  }

  selectProvider() {
    const providers = Array.from(this.providers.values());

    if (providers.length === 0) {
      return null;
    }

    return providers[Math.floor(Math.random() * providers.length)];
  }

  async getStatus(sessionId) {
    const execution = this.activeExecutions.get(sessionId);
    if (!execution || !execution.provider) {
      throw new Error(`No active execution found for session: ${sessionId}`);
    }

    return await execution.provider.getStatus(execution.jobName || execution.taskArn || sessionId);
  }

  async getLogs(sessionId) {
    const execution = this.activeExecutions.get(sessionId);
    if (!execution || !execution.provider) {
      throw new Error(`No active execution found for session: ${sessionId}`);
    }

    return await execution.provider.getLogs(execution.jobName || execution.taskArn || sessionId);
  }

  async cleanup(sessionId) {
    const execution = this.activeExecutions.get(sessionId);
    if (!execution) {
      return;
    }

    if (execution.cleanup) {
      await execution.cleanup();
    }

    this.activeExecutions.delete(sessionId);
  }

  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  isCloudAvailable() {
    return this.providers.size > 0;
  }

  getStats() {
    return {
      availableProviders: Array.from(this.providers.keys()),
      activeExecutions: this.activeExecutions.size,
    };
  }
}

module.exports = new CloudExecutorService();
