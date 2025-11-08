const Docker = require('dockerode');
const pty = require('node-pty');
const logger = require('../utils/logger');
const languageRuntimeService = require('./language-runtime.service');
const os = require('os');

class LocalExecutorService {
  constructor() {
    this.docker = new Docker();
    this.containers = new Map();
    this.ptyProcesses = new Map();

    this.resourceLimits = {
      memory: 512 * 1024 * 1024, // 512MB
      cpus: 1.0,
      timeout: 300000, // 5 minutes
    };
  }

  async createContainerSession(sessionId, options) {
    const { language, file, workspaceDir, isRepl, env = {} } = options;

    languageRuntimeService.validateLanguage(language);
    const dockerImage = languageRuntimeService.getDockerImage(language);

    try {
      await this.ensureImage(dockerImage);

      const cmd = isRepl
        ? languageRuntimeService.getCommandTemplate(language, null, true)
        : file
          ? languageRuntimeService.getCommandTemplate(language, `/workspace/${file}`)
          : ['/bin/sh'];

      const containerConfig = {
        Image: dockerImage,
        Cmd: cmd,
        Tty: true,
        OpenStdin: true,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        HostConfig: {
          Memory: this.resourceLimits.memory,
          NanoCpus: this.resourceLimits.cpus * 1e9,
          NetworkMode: 'none',
          ReadonlyRootfs: false,
          AutoRemove: true,
          Binds: workspaceDir ? [`${workspaceDir}:/workspace:ro`] : [],
        },
        Env: Object.entries(env).map(([key, value]) => `${key}=${value}`),
        WorkingDir: workspaceDir ? '/workspace' : '/',
      };

      const container = await this.docker.createContainer(containerConfig);
      await container.start();

      this.containers.set(sessionId, container);

      const stream = await container.attach({
        stream: true,
        stdin: true,
        stdout: true,
        stderr: true,
      });

      const timeout = setTimeout(async () => {
        logger.warn(`Container ${sessionId} timeout reached, stopping`);
        await this.stopContainer(sessionId);
      }, this.resourceLimits.timeout);

      logger.info(`Container created for session ${sessionId}`, {
        language,
        image: dockerImage,
      });

      return {
        type: 'container',
        sessionId,
        stream,
        container,
        timeout,
        cleanup: async () => {
          clearTimeout(timeout);
          await this.stopContainer(sessionId);
        },
        write: (data) => {
          if (stream.writable) {
            stream.write(data);
          }
        },
        resize: async (cols, rows) => {
          try {
            await container.resize({ h: rows, w: cols });
          } catch (error) {
            logger.error(`Failed to resize container ${sessionId}:`, error);
          }
        },
      };
    } catch (error) {
      logger.error(`Failed to create container for session ${sessionId}:`, error);
      throw error;
    }
  }

  async createPtySession(sessionId, options) {
    const { language, file, workspaceDir, isRepl, env = {} } = options;

    try {
      const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
      const args = [];

      let command = shell;
      let commandArgs = args;

      if (language && language !== 'bash') {
        languageRuntimeService.validateLanguage(language);
        if (isRepl) {
          const replCmd = languageRuntimeService.getCommandTemplate(language, null, true);
          command = replCmd[0];
          commandArgs = replCmd.slice(1);
        } else if (file) {
          const cmd = languageRuntimeService.getCommandTemplate(language, file);
          command = cmd[0];
          commandArgs = cmd.slice(1);
        }
      }

      const ptyProcess = pty.spawn(command, commandArgs, {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: workspaceDir || process.cwd(),
        env: { ...process.env, ...env },
      });

      this.ptyProcesses.set(sessionId, ptyProcess);

      const timeout = setTimeout(() => {
        logger.warn(`PTY session ${sessionId} timeout reached, stopping`);
        this.stopPty(sessionId);
      }, this.resourceLimits.timeout);

      logger.info(`PTY session created for session ${sessionId}`, {
        language,
        command,
      });

      return {
        type: 'pty',
        sessionId,
        ptyProcess,
        timeout,
        cleanup: () => {
          clearTimeout(timeout);
          this.stopPty(sessionId);
        },
        write: (data) => {
          if (ptyProcess) {
            ptyProcess.write(data);
          }
        },
        resize: (cols, rows) => {
          if (ptyProcess) {
            ptyProcess.resize(cols, rows);
          }
        },
      };
    } catch (error) {
      logger.error(`Failed to create PTY session ${sessionId}:`, error);
      throw error;
    }
  }

  async ensureImage(imageName) {
    try {
      await this.docker.getImage(imageName).inspect();
      logger.debug(`Docker image ${imageName} already exists`);
    } catch (error) {
      logger.info(`Pulling Docker image ${imageName}...`);
      await new Promise((resolve, reject) => {
        this.docker.pull(imageName, (err, stream) => {
          if (err) {
            return reject(err);
          }
          this.docker.modem.followProgress(stream, (err, output) => {
            if (err) {
              return reject(err);
            }
            resolve(output);
          });
        });
      });
      logger.info(`Docker image ${imageName} pulled successfully`);
    }
  }

  async stopContainer(sessionId) {
    const container = this.containers.get(sessionId);
    if (!container) {
      return;
    }

    try {
      const info = await container.inspect();
      if (info.State.Running) {
        await container.stop({ t: 5 });
      }
    } catch (error) {
      logger.error(`Error stopping container ${sessionId}:`, error);
    } finally {
      this.containers.delete(sessionId);
    }
  }

  stopPty(sessionId) {
    const ptyProcess = this.ptyProcesses.get(sessionId);
    if (!ptyProcess) {
      return;
    }

    try {
      ptyProcess.kill();
    } catch (error) {
      logger.error(`Error stopping PTY ${sessionId}:`, error);
    } finally {
      this.ptyProcesses.delete(sessionId);
    }
  }

  async execute(sessionId, options) {
    const { useContainer = true } = options;

    if (useContainer) {
      return await this.createContainerSession(sessionId, options);
    } else {
      return await this.createPtySession(sessionId, options);
    }
  }

  async cleanup(sessionId) {
    await this.stopContainer(sessionId);
    this.stopPty(sessionId);
  }

  async cleanupAll() {
    const containerIds = Array.from(this.containers.keys());
    const ptyIds = Array.from(this.ptyProcesses.keys());

    for (const sessionId of containerIds) {
      await this.stopContainer(sessionId);
    }

    for (const sessionId of ptyIds) {
      this.stopPty(sessionId);
    }
  }

  getStats() {
    return {
      activeContainers: this.containers.size,
      activePtyProcesses: this.ptyProcesses.size,
      resourceLimits: this.resourceLimits,
    };
  }
}

module.exports = new LocalExecutorService();
