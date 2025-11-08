const assert = require('assert');
const languageRuntimeService = require('../src/services/language-runtime.service');
const terminalSessionService = require('../src/services/terminal-session.service');
const terminalOrchestratorService = require('../src/services/terminal-orchestrator.service');

describe('Terminal Orchestration', () => {
  describe('Language Runtime Service', () => {
    it('should support 8+ languages', () => {
      const languages = languageRuntimeService.getSupportedLanguages();
      assert(languages.length >= 8, 'Should support at least 8 languages');
      assert(languages.includes('javascript'));
      assert(languages.includes('python'));
      assert(languages.includes('java'));
      assert(languages.includes('go'));
      assert(languages.includes('rust'));
      assert(languages.includes('ruby'));
      assert(languages.includes('bash'));
      assert(languages.includes('typescript'));
    });

    it('should detect language from filename', () => {
      assert.strictEqual(languageRuntimeService.detectLanguage('test.py'), 'python');
      assert.strictEqual(languageRuntimeService.detectLanguage('test.js'), 'javascript');
      assert.strictEqual(languageRuntimeService.detectLanguage('test.java'), 'java');
      assert.strictEqual(languageRuntimeService.detectLanguage('test.go'), 'go');
      assert.strictEqual(languageRuntimeService.detectLanguage('test.rs'), 'rust');
      assert.strictEqual(languageRuntimeService.detectLanguage('test.rb'), 'ruby');
      assert.strictEqual(languageRuntimeService.detectLanguage('test.sh'), 'bash');
      assert.strictEqual(languageRuntimeService.detectLanguage('test.ts'), 'typescript');
    });

    it('should get runtime config', () => {
      const pythonConfig = languageRuntimeService.getRuntimeConfig('python');
      assert(pythonConfig);
      assert.strictEqual(pythonConfig.dockerImage, 'python:3.11-alpine');
      assert(Array.isArray(pythonConfig.extensions));
    });

    it('should get capability matrix', () => {
      const matrix = languageRuntimeService.getCapabilityMatrix();
      assert(Array.isArray(matrix));
      assert(matrix.length >= 8);

      const pythonCap = matrix.find((c) => c.language === 'python');
      assert(pythonCap);
      assert.strictEqual(pythonCap.hasRepl, true);
    });

    it('should validate supported languages', () => {
      assert.doesNotThrow(() => {
        languageRuntimeService.validateLanguage('python');
      });

      assert.throws(() => {
        languageRuntimeService.validateLanguage('unsupported');
      }, /Unsupported language/);
    });

    it('should get command template', () => {
      const cmd = languageRuntimeService.getCommandTemplate('python', 'script.py');
      assert(Array.isArray(cmd));
      assert.strictEqual(cmd[0], 'python3');
      assert.strictEqual(cmd[1], 'script.py');
    });

    it('should get REPL command', () => {
      const cmd = languageRuntimeService.getCommandTemplate('python', null, true);
      assert(Array.isArray(cmd));
      assert.strictEqual(cmd[0], 'python3');
    });
  });

  describe('Terminal Session Service', () => {
    beforeEach(() => {
      terminalSessionService.sessions.clear();
      terminalSessionService.sessionTimeouts.clear();
    });

    it('should create a session', () => {
      const session = terminalSessionService.createSession({
        userId: 'user1',
        roomId: 'room1',
        language: 'python',
        mode: 'local',
      });

      assert(session.id);
      assert.strictEqual(session.userId, 'user1');
      assert.strictEqual(session.language, 'python');
      assert.strictEqual(session.status, 'creating');
    });

    it('should get session by id', () => {
      const session = terminalSessionService.createSession({
        userId: 'user1',
        language: 'python',
        mode: 'local',
      });

      const retrieved = terminalSessionService.getSession(session.id);
      assert.strictEqual(retrieved.id, session.id);
    });

    it('should update session', () => {
      const session = terminalSessionService.createSession({
        userId: 'user1',
        language: 'python',
        mode: 'local',
      });

      const updated = terminalSessionService.updateSession(session.id, {
        status: 'running',
      });

      assert.strictEqual(updated.status, 'running');
    });

    it('should get user sessions', () => {
      terminalSessionService.createSession({
        userId: 'user1',
        language: 'python',
        mode: 'local',
      });

      terminalSessionService.createSession({
        userId: 'user1',
        language: 'javascript',
        mode: 'local',
      });

      const sessions = terminalSessionService.getUserSessions('user1');
      assert.strictEqual(sessions.length, 2);
    });

    it('should get room sessions', () => {
      terminalSessionService.createSession({
        userId: 'user1',
        roomId: 'room1',
        language: 'python',
        mode: 'local',
      });

      const sessions = terminalSessionService.getRoomSessions('room1');
      assert.strictEqual(sessions.length, 1);
    });

    it('should enforce max sessions limit', () => {
      const originalMax = terminalSessionService.maxSessions;
      terminalSessionService.maxSessions = 2;

      terminalSessionService.createSession({
        userId: 'user1',
        language: 'python',
        mode: 'local',
      });

      terminalSessionService.createSession({
        userId: 'user2',
        language: 'javascript',
        mode: 'local',
      });

      assert.throws(() => {
        terminalSessionService.createSession({
          userId: 'user3',
          language: 'java',
          mode: 'local',
        });
      }, /Maximum number of sessions/);

      terminalSessionService.maxSessions = originalMax;
    });

    it('should get session stats', () => {
      terminalSessionService.createSession({
        userId: 'user1',
        language: 'python',
        mode: 'local',
      });

      terminalSessionService.createSession({
        userId: 'user2',
        language: 'python',
        mode: 'cloud',
      });

      const stats = terminalSessionService.getStats();
      assert.strictEqual(stats.total, 2);
      assert.strictEqual(stats.byMode.local, 1);
      assert.strictEqual(stats.byMode.cloud, 1);
      assert.strictEqual(stats.byLanguage.python, 2);
    });
  });

  describe('Terminal Orchestrator Service', () => {
    beforeEach(() => {
      terminalSessionService.sessions.clear();
      terminalSessionService.sessionTimeouts.clear();
    });

    it('should sanitize input', () => {
      const safe = 'echo "hello"';
      assert.doesNotThrow(() => {
        terminalOrchestratorService.sanitizeInput(safe);
      });
    });

    it('should block dangerous patterns', () => {
      const dangerous = 'rm -rf /';
      assert.throws(() => {
        terminalOrchestratorService.sanitizeInput(dangerous);
      }, /blocked pattern/);
    });

    it('should reject too long input', () => {
      const longInput = 'a'.repeat(20000);
      assert.throws(() => {
        terminalOrchestratorService.sanitizeInput(longInput);
      }, /exceeds maximum length/);
    });

    it('should get capability matrix', () => {
      const matrix = terminalOrchestratorService.getCapabilityMatrix();
      assert(matrix.languages);
      assert(matrix.executionModes);
      assert(matrix.executionModes.local);
      assert.strictEqual(matrix.executionModes.local.available, true);
    });

    it('should get stats', () => {
      const stats = terminalOrchestratorService.getStats();
      assert(stats.sessions);
      assert(stats.capability);
    });
  });

  describe('Integration - Session Lifecycle', () => {
    beforeEach(() => {
      terminalSessionService.sessions.clear();
      terminalSessionService.sessionTimeouts.clear();
    });

    after(async () => {
      await terminalOrchestratorService.cleanup();
    });

    it('should handle multiple languages', () => {
      const languages = [
        'javascript',
        'python',
        'java',
        'go',
        'rust',
        'ruby',
        'bash',
        'typescript',
      ];

      languages.forEach((language) => {
        assert.doesNotThrow(() => {
          languageRuntimeService.validateLanguage(language);
          const config = languageRuntimeService.getRuntimeConfig(language);
          assert(config, `Config should exist for ${language}`);
        });
      });
    });

    it('should support different execution modes', () => {
      const modes = ['local', 'cloud', 'auto'];

      modes.forEach((mode) => {
        const session = terminalSessionService.createSession({
          userId: 'user1',
          language: 'python',
          mode,
        });

        assert.strictEqual(session.mode, mode);
      });
    });
  });
});
