const { expect } = require('chai');
const sinon = require('sinon');
const aiAssistantService = require('../src/services/ai-assistant.service');
const { AICredential } = require('../src/models');
const aiProviderFactory = require('../src/services/ai/ai-provider-factory');

describe('AI Assistant Service', () => {
  let sandbox;
  let mockProvider;
  let mockCredential;

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Mock provider
    mockProvider = {
      streamCompletion: sandbox.stub(),
      completion: sandbox.stub(),
      getCapabilities: sandbox.stub().returns({
        supportedModels: ['gpt-3.5-turbo'],
        maxTokens: 4096,
        provider: 'openai',
      }),
    };

    // Mock credential
    mockCredential = {
      getApiKey: sandbox.stub().returns('test-api-key'),
      incrementUsage: sandbox.stub().resolves(),
      provider: 'openai',
      metadata: {},
    };

    // Setup factory
    aiProviderFactory.registerProvider('openai', mockProvider, true);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getUserProvider', () => {
    it('should return user provider with credential', async () => {
      sandbox.stub(AICredential, 'findByUserAndProvider').resolves(mockCredential);

      const result = await aiAssistantService.getUserProvider('user123', 'openai');

      expect(result.providerName).to.equal('openai');
      expect(result.credential).to.equal(mockCredential);
    });

    it('should fallback to default provider when no user credential', async () => {
      sandbox.stub(AICredential, 'findByUserAndProvider').resolves(null);
      sandbox.stub(AICredential, 'findByUser').resolves([]);

      const result = await aiAssistantService.getUserProvider('user123');

      expect(result.providerName).to.equal('openai');
      expect(result.credential).to.be.null;
    });
  });

  describe('buildPrompt', () => {
    it('should build basic prompt with context', () => {
      const context = {
        language: 'javascript',
        fileContent: 'const x = 1;',
        instruction: 'Complete this code',
      };

      const prompt = aiAssistantService.buildPrompt(context);

      expect(prompt).to.include('Language: javascript');
      expect(prompt).to.include('Task: Complete this code');
      expect(prompt).to.include('const x = 1;');
    });

    it('should handle large files with chunking', () => {
      const largeContent = 'a'.repeat(10000);
      const context = {
        fileContent: largeContent,
        cursorPosition: 5000,
      };

      const prompt = aiAssistantService.buildPrompt(context);

      expect(prompt).to.include('Note: Showing excerpt from larger file');
      expect(prompt.length).to.be.below(largeContent.length);
    });

    it('should include recent operations', () => {
      const context = {
        fileContent: 'test code',
        recentOperations: [
          { type: 'insert', content: 'new code' },
          { type: 'delete', content: 'old code' },
        ],
      };

      const prompt = aiAssistantService.buildPrompt(context);

      expect(prompt).to.include('Recent changes:');
      expect(prompt).to.include('insert: "new code"');
      expect(prompt).to.include('delete: "old code"');
    });
  });

  describe('streamCompletion', () => {
    it('should stream completion successfully', async () => {
      // Mock provider response
      const mockStream = (async function* () {
        yield { content: 'Hello', finishReason: null };
        yield { content: ' world', finishReason: 'stop', usage: { total_tokens: 10 } };
      })();

      mockProvider.streamCompletion.resolves(mockStream);
      sandbox.stub(AICredential, 'findByUserAndProvider').resolves(mockCredential);

      const params = {
        userId: 'user123',
        sessionId: 'session456',
        context: { fileContent: 'console.log' },
        provider: 'openai',
      };

      const chunks = [];
      for await (const chunk of aiAssistantService.streamCompletion(params)) {
        chunks.push(chunk);
      }

      expect(chunks).to.have.length(2);
      expect(chunks[0].content).to.equal('Hello');
      expect(chunks[1].content).to.equal(' world');
      expect(chunks[1].finishReason).to.equal('stop');
      expect(mockCredential.incrementUsage.calledOnce).to.be.true;
    });

    it('should use cache when available', async () => {
      const mockStream = (async function* () {
        yield { content: 'cached response', finishReason: 'stop' };
      })();

      mockProvider.streamCompletion.resolves(mockStream);
      sandbox.stub(AICredential, 'findByUserAndProvider').resolves(mockCredential);

      const params = {
        userId: 'user123',
        sessionId: 'session456',
        context: { fileContent: 'test' },
        useCache: true,
      };

      // First call should hit provider
      const chunks1 = [];
      for await (const chunk of aiAssistantService.streamCompletion(params)) {
        chunks1.push(chunk);
      }

      // Second call should use cache
      const chunks2 = [];
      for await (const chunk of aiAssistantService.streamCompletion(params)) {
        chunks2.push(chunk);
      }

      expect(chunks1[0].content).to.equal('cached response');
      expect(chunks2[0].content).to.equal('cached response');
      expect(chunks2[0].finishReason).to.equal('cached');
    });

    it('should handle rate limiting', async () => {
      mockProvider.checkRateLimit = sandbox.stub().returns(false);
      sandbox.stub(AICredential, 'findByUserAndProvider').resolves(mockCredential);

      const params = {
        userId: 'user123',
        sessionId: 'session456',
        context: { fileContent: 'test' },
      };

      let error;
      try {
        for await (const _chunk of aiAssistantService.streamCompletion(params)) {
          // Should not reach here but we need to consume the generator
          _chunk;
        }
      } catch (e) {
        error = e;
      }

      expect(error).to.exist;
      expect(error.message).to.equal('Rate limit exceeded');
    });
  });

  describe('explainCode', () => {
    it('should stream code explanation', async () => {
      const mockStream = (async function* () {
        yield { content: 'This code ', finishReason: null };
        yield { content: 'does X', finishReason: 'stop' };
      })();

      sandbox.stub(aiAssistantService, 'streamCompletion').resolves(mockStream);

      const params = {
        code: 'const x = 1;',
        language: 'javascript',
        userId: 'user123',
        sessionId: 'session456',
      };

      const chunks = [];
      for await (const chunk of aiAssistantService.explainCode(params)) {
        chunks.push(chunk);
      }

      expect(chunks).to.have.length(2);
      expect(chunks[0].content).to.equal('This code ');
      expect(chunks[1].content).to.equal('does X');
    });
  });

  describe('refactorCode', () => {
    it('should stream code refactoring', async () => {
      const mockStream = (async function* () {
        yield { content: 'Here is the ', finishReason: null };
        yield { content: 'refactored code', finishReason: 'stop' };
      })();

      sandbox.stub(aiAssistantService, 'streamCompletion').resolves(mockStream);

      const params = {
        code: 'function old() {}',
        language: 'javascript',
        refactorType: 'modernize',
        userId: 'user123',
        sessionId: 'session456',
      };

      const chunks = [];
      for await (const chunk of aiAssistantService.refactorCode(params)) {
        chunks.push(chunk);
      }

      expect(chunks).to.have.length(2);
      expect(chunks[0].content).to.equal('Here is the ');
      expect(chunks[1].content).to.equal('refactored code');
    });
  });

  describe('cancelRequest', () => {
    it('should cancel active request', () => {
      const userId = 'user123';
      const sessionId = 'session456';

      // Simulate active request
      aiAssistantService.activeRequests.set(`${userId}:${sessionId}`, 'request-id');

      aiAssistantService.cancelRequest(userId, sessionId);

      expect(aiAssistantService.activeRequests.has(`${userId}:${sessionId}`)).to.be.false;
    });
  });

  describe('getProviders', () => {
    it('should return available providers', () => {
      const providers = aiAssistantService.getProviders();

      expect(providers).to.have.property('available');
      expect(providers).to.have.property('default');
      expect(providers.default).to.equal('openai');
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = aiAssistantService.getCacheStats();

      expect(stats).to.have.property('size');
      expect(stats).to.have.property('maxSize');
      expect(stats).to.have.property('ttlMs');
    });
  });
});
