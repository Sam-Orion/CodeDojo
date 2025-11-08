const { ContainerInstanceManagementClient } = require('@azure/arm-containerinstance');
const { DefaultAzureCredential } = require('@azure/identity');
const logger = require('../../utils/logger');

class AzureProvider {
  constructor(config) {
    this.subscriptionId = config.subscriptionId;
    this.resourceGroup = config.resourceGroup || 'terminal-resources';
    this.location = config.location || 'eastus';
    this.enabled = config.enabled || false;

    if (this.enabled && this.subscriptionId) {
      try {
        const credential = new DefaultAzureCredential();
        this.client = new ContainerInstanceManagementClient(credential, this.subscriptionId);
        logger.info('Azure provider initialized', {
          subscriptionId: this.subscriptionId,
          location: this.location,
        });
      } catch (error) {
        logger.error('Failed to initialize Azure provider:', error);
        this.enabled = false;
      }
    } else {
      this.enabled = false;
    }
  }

  async execute(sessionId, options) {
    if (!this.enabled) {
      throw new Error('Azure provider not enabled or configured');
    }

    const { language, file, env = {} } = options;

    try {
      const containerGroupName = `terminal-${sessionId.substring(0, 8)}`;

      const containerGroup = {
        location: this.location,
        containers: [
          {
            name: 'terminal-container',
            image: this.getContainerImage(language),
            command: this.getCommand(language, file),
            environmentVariables: Object.entries(env).map(([name, value]) => ({ name, value })),
            resources: {
              requests: {
                memoryInGB: 0.5,
                cpu: 1.0,
              },
            },
          },
        ],
        osType: 'Linux',
        restartPolicy: 'Never',
      };

      logger.info(`Creating Azure Container Instance for session ${sessionId}`, {
        containerGroupName,
        language,
      });

      await this.client.containerGroups.beginCreateOrUpdateAndWait(
        this.resourceGroup,
        containerGroupName,
        containerGroup
      );

      return {
        type: 'azure',
        sessionId,
        containerGroupName,
        status: 'running',
        cleanup: async () => {
          await this.cleanup(containerGroupName);
        },
      };
    } catch (error) {
      logger.error(`Azure execution failed for session ${sessionId}:`, error);
      throw new Error(`Azure execution failed: ${error.message}`);
    }
  }

  async getStatus(containerGroupName) {
    if (!this.enabled) {
      throw new Error('Azure provider not enabled');
    }

    try {
      const containerGroup = await this.client.containerGroups.get(
        this.resourceGroup,
        containerGroupName
      );

      const state = containerGroup.containers?.[0]?.instanceView?.currentState;

      return {
        status: state?.state || 'unknown',
        succeeded: state?.state === 'Terminated' && state?.exitCode === 0,
        failed: state?.state === 'Terminated' && state?.exitCode !== 0,
      };
    } catch (error) {
      logger.error('Failed to get Azure container status:', error);
      throw error;
    }
  }

  async getLogs(containerGroupName) {
    if (!this.enabled) {
      throw new Error('Azure provider not enabled');
    }

    try {
      const logs = await this.client.containers.listLogs(
        this.resourceGroup,
        containerGroupName,
        'terminal-container'
      );
      return logs.content ? logs.content.split('\n') : [];
    } catch (error) {
      logger.error('Failed to get Azure container logs:', error);
      return [];
    }
  }

  async cleanup(containerGroupName) {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.containerGroups.beginDeleteAndWait(this.resourceGroup, containerGroupName);
      logger.info(`Cleaned up Azure container: ${containerGroupName}`);
    } catch (error) {
      logger.error(`Failed to cleanup Azure container ${containerGroupName}:`, error);
    }
  }

  getContainerImage(language) {
    const images = {
      javascript: 'node:20-alpine',
      typescript: 'node:20-alpine',
      python: 'python:3.11-alpine',
      java: 'openjdk:17-alpine',
      go: 'golang:1.21-alpine',
      rust: 'rust:1.75-alpine',
      ruby: 'ruby:3.2-alpine',
      bash: 'bash:latest',
    };
    return images[language] || 'node:20-alpine';
  }

  getCommand(language, file) {
    const commands = {
      javascript: ['node', file],
      typescript: ['npx', 'ts-node', file],
      python: ['python3', file],
      java: ['sh', '-c', `javac ${file} && java ${file.replace('.java', '')}`],
      go: ['go', 'run', file],
      rust: ['sh', '-c', `rustc ${file} -o /tmp/output && /tmp/output`],
      ruby: ['ruby', file],
      bash: ['bash', file],
    };
    return commands[language] || ['/bin/sh'];
  }

  isEnabled() {
    return this.enabled;
  }
}

module.exports = AzureProvider;
