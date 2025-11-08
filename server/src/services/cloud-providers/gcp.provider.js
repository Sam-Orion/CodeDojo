const { v1 } = require('@google-cloud/run');
const logger = require('../../utils/logger');

class GCPProvider {
  constructor(config) {
    this.projectId = config.projectId;
    this.region = config.region || 'us-central1';
    this.enabled = config.enabled || false;

    if (this.enabled) {
      try {
        this.client = new v1.JobsClient();
        logger.info('GCP provider initialized', { projectId: this.projectId, region: this.region });
      } catch (error) {
        logger.error('Failed to initialize GCP provider:', error);
        this.enabled = false;
      }
    }
  }

  async execute(sessionId, options) {
    if (!this.enabled) {
      throw new Error('GCP provider not enabled or configured');
    }

    const { language, file, env = {}, timeout = 300 } = options;

    try {
      const jobName = `terminal-${sessionId.substring(0, 8)}`;
      const parent = `projects/${this.projectId}/locations/${this.region}`;

      const job = {
        name: `${parent}/jobs/${jobName}`,
        template: {
          template: {
            containers: [
              {
                image: this.getContainerImage(language),
                command: this.getCommand(language, file),
                env: Object.entries(env).map(([name, value]) => ({ name, value })),
                resources: {
                  limits: {
                    memory: '512Mi',
                    cpu: '1',
                  },
                },
              },
            ],
            timeout: `${timeout}s`,
          },
        },
      };

      logger.info(`Creating GCP Cloud Run job for session ${sessionId}`, {
        jobName,
        language,
      });

      const [operation] = await this.client.createJob({ parent, job, jobId: jobName });
      const [response] = await operation.promise();

      return {
        type: 'gcp',
        sessionId,
        jobName: response.name,
        status: 'running',
        cleanup: async () => {
          await this.cleanup(response.name);
        },
      };
    } catch (error) {
      logger.error(`GCP execution failed for session ${sessionId}:`, error);
      throw new Error(`GCP execution failed: ${error.message}`);
    }
  }

  async getStatus(jobName) {
    if (!this.enabled) {
      throw new Error('GCP provider not enabled');
    }

    try {
      const [job] = await this.client.getJob({ name: jobName });
      return {
        status: job.terminalCondition?.state || 'unknown',
        succeeded: job.terminalCondition?.state === 'CONDITION_SUCCEEDED',
        failed: job.terminalCondition?.state === 'CONDITION_FAILED',
      };
    } catch (error) {
      logger.error(`Failed to get GCP job status:`, error);
      throw error;
    }
  }

  async getLogs(_jobName) {
    if (!this.enabled) {
      throw new Error('GCP provider not enabled');
    }

    logger.warn('GCP log retrieval not yet implemented');
    return [];
  }

  async cleanup(jobName) {
    if (!this.enabled) {
      return;
    }

    try {
      await this.client.deleteJob({ name: jobName });
      logger.info(`Cleaned up GCP job: ${jobName}`);
    } catch (error) {
      logger.error(`Failed to cleanup GCP job ${jobName}:`, error);
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
    return commands[language] || ['sh'];
  }

  isEnabled() {
    return this.enabled;
  }
}

module.exports = GCPProvider;
