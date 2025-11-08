class LanguageRuntimeService {
  constructor() {
    this.runtimes = {
      javascript: {
        extensions: ['.js', '.mjs', '.cjs'],
        dockerImage: 'node:20-alpine',
        command: (file) => ['node', file],
        replCommand: ['node'],
        version: 'node --version',
      },
      typescript: {
        extensions: ['.ts'],
        dockerImage: 'node:20-alpine',
        command: (file) => ['npx', 'ts-node', file],
        replCommand: ['npx', 'ts-node'],
        version: 'npx ts-node --version',
        setup: ['npm', 'install', '-g', 'ts-node', 'typescript'],
      },
      python: {
        extensions: ['.py'],
        dockerImage: 'python:3.11-alpine',
        command: (file) => ['python3', file],
        replCommand: ['python3'],
        version: 'python3 --version',
      },
      java: {
        extensions: ['.java'],
        dockerImage: 'openjdk:17-alpine',
        command: (file) => {
          const className = file.replace('.java', '');
          return ['sh', '-c', `javac ${file} && java ${className}`];
        },
        replCommand: ['jshell'],
        version: 'java --version',
      },
      c: {
        extensions: ['.c'],
        dockerImage: 'gcc:latest',
        command: (file) => ['sh', '-c', `gcc ${file} -o /tmp/output && /tmp/output`],
        version: 'gcc --version',
      },
      cpp: {
        extensions: ['.cpp', '.cc', '.cxx'],
        dockerImage: 'gcc:latest',
        command: (file) => ['sh', '-c', `g++ ${file} -o /tmp/output && /tmp/output`],
        version: 'g++ --version',
      },
      go: {
        extensions: ['.go'],
        dockerImage: 'golang:1.21-alpine',
        command: (file) => ['go', 'run', file],
        replCommand: ['sh'],
        version: 'go version',
      },
      rust: {
        extensions: ['.rs'],
        dockerImage: 'rust:1.75-alpine',
        command: (file) => ['sh', '-c', `rustc ${file} -o /tmp/output && /tmp/output`],
        version: 'rustc --version',
      },
      ruby: {
        extensions: ['.rb'],
        dockerImage: 'ruby:3.2-alpine',
        command: (file) => ['ruby', file],
        replCommand: ['irb'],
        version: 'ruby --version',
      },
      bash: {
        extensions: ['.sh'],
        dockerImage: 'bash:latest',
        command: (file) => ['bash', file],
        replCommand: ['bash'],
        version: 'bash --version',
      },
    };
  }

  detectLanguage(filename) {
    if (!filename) {
      return null;
    }

    for (const [language, config] of Object.entries(this.runtimes)) {
      if (config.extensions.some((ext) => filename.endsWith(ext))) {
        return language;
      }
    }

    return null;
  }

  getRuntimeConfig(language) {
    return this.runtimes[language] || null;
  }

  getSupportedLanguages() {
    return Object.keys(this.runtimes);
  }

  getCapabilityMatrix() {
    return Object.entries(this.runtimes).map(([language, config]) => ({
      language,
      extensions: config.extensions,
      hasRepl: !!config.replCommand,
      dockerImage: config.dockerImage,
    }));
  }

  getCommandTemplate(language, file, isRepl = false) {
    const config = this.runtimes[language];
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }

    if (isRepl) {
      if (!config.replCommand) {
        throw new Error(`REPL not supported for language: ${language}`);
      }
      return config.replCommand;
    }

    if (!file) {
      throw new Error('File required for non-REPL execution');
    }

    return config.command(file);
  }

  validateLanguage(language) {
    if (!this.runtimes[language]) {
      throw new Error(
        `Unsupported language: ${language}. Supported: ${this.getSupportedLanguages().join(', ')}`
      );
    }
    return true;
  }

  getDockerImage(language) {
    const config = this.runtimes[language];
    if (!config) {
      throw new Error(`Unsupported language: ${language}`);
    }
    return config.dockerImage;
  }

  getSetupCommands(language) {
    const config = this.runtimes[language];
    return config?.setup || [];
  }
}

module.exports = new LanguageRuntimeService();
