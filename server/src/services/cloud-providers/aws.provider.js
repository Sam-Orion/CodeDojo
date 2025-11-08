const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { ECSClient, RunTaskCommand, DescribeTasksCommand } = require('@aws-sdk/client-ecs');
const logger = require('../../utils/logger');

class AWSProvider {
  constructor(config) {
    this.region = config.region || 'us-east-1';
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.enabled = config.enabled || false;
    this.useLambda = config.useLambda !== false;
    this.clusterName = config.clusterName || 'terminal-cluster';
    this.taskDefinition = config.taskDefinition || 'terminal-task';

    if (this.enabled && this.accessKeyId && this.secretAccessKey) {
      try {
        const credentials = {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        };

        if (this.useLambda) {
          this.lambdaClient = new LambdaClient({ region: this.region, credentials });
        } else {
          this.ecsClient = new ECSClient({ region: this.region, credentials });
        }

        logger.info('AWS provider initialized', {
          region: this.region,
          mode: this.useLambda ? 'Lambda' : 'ECS Fargate',
        });
      } catch (error) {
        logger.error('Failed to initialize AWS provider:', error);
        this.enabled = false;
      }
    } else {
      this.enabled = false;
    }
  }

  async execute(sessionId, options) {
    if (!this.enabled) {
      throw new Error('AWS provider not enabled or configured');
    }

    if (this.useLambda) {
      return await this.executeLambda(sessionId, options);
    } else {
      return await this.executeFargate(sessionId, options);
    }
  }

  async executeLambda(sessionId, options) {
    const { language, code, file, env = {} } = options;

    try {
      const payload = JSON.stringify({
        sessionId,
        language,
        code,
        file,
        env,
      });

      const command = new InvokeCommand({
        FunctionName: `terminal-executor-${language}`,
        InvocationType: 'Event',
        Payload: payload,
      });

      logger.info(`Invoking AWS Lambda for session ${sessionId}`, { language });

      const response = await this.lambdaClient.send(command);

      return {
        type: 'aws-lambda',
        sessionId,
        requestId: response.RequestId,
        status: 'running',
        cleanup: async () => {
          logger.info(`Lambda execution cleanup for ${sessionId}`);
        },
      };
    } catch (error) {
      logger.error(`AWS Lambda execution failed for session ${sessionId}:`, error);
      throw new Error(`AWS Lambda execution failed: ${error.message}`);
    }
  }

  async executeFargate(sessionId, options) {
    const { language, file, env = {} } = options;

    try {
      const command = new RunTaskCommand({
        cluster: this.clusterName,
        taskDefinition: this.taskDefinition,
        launchType: 'FARGATE',
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: [],
            assignPublicIp: 'ENABLED',
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: 'terminal-container',
              environment: [
                { name: 'SESSION_ID', value: sessionId },
                { name: 'LANGUAGE', value: language },
                { name: 'FILE', value: file || '' },
                ...Object.entries(env).map(([name, value]) => ({ name, value })),
              ],
            },
          ],
        },
      });

      logger.info(`Starting AWS Fargate task for session ${sessionId}`, { language });

      const response = await this.ecsClient.send(command);
      const taskArn = response.tasks?.[0]?.taskArn;

      return {
        type: 'aws-fargate',
        sessionId,
        taskArn,
        status: 'running',
        cleanup: async () => {
          logger.info(`Fargate task cleanup for ${sessionId}`);
        },
      };
    } catch (error) {
      logger.error(`AWS Fargate execution failed for session ${sessionId}:`, error);
      throw new Error(`AWS Fargate execution failed: ${error.message}`);
    }
  }

  async getStatus(taskArn) {
    if (!this.enabled) {
      throw new Error('AWS provider not enabled');
    }

    if (this.useLambda) {
      return { status: 'unknown' };
    }

    try {
      const command = new DescribeTasksCommand({
        cluster: this.clusterName,
        tasks: [taskArn],
      });

      const response = await this.ecsClient.send(command);
      const task = response.tasks?.[0];

      return {
        status: task?.lastStatus || 'unknown',
        succeeded: task?.lastStatus === 'STOPPED' && task?.stopCode === 'EssentialContainerExited',
        failed: task?.lastStatus === 'STOPPED' && task?.stopCode !== 'EssentialContainerExited',
      };
    } catch (error) {
      logger.error('Failed to get AWS task status:', error);
      throw error;
    }
  }

  async getLogs(_taskArn) {
    if (!this.enabled) {
      throw new Error('AWS provider not enabled');
    }

    logger.warn('AWS log retrieval not yet implemented');
    return [];
  }

  isEnabled() {
    return this.enabled;
  }
}

module.exports = AWSProvider;
