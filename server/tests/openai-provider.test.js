const { expect } = require('chai');
const sinon = require('sinon');
require('dotenv').config();

// Mock dependencies before importing
const mockFetch = sinon.stub();
global.fetch = mockFetch;

const OpenAIProvider = require('../src/services/ai/openai.provider');

describe('OpenAI Provider', () => {
  let provider;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    provider = new OpenAIProvider({
      apiKey: 'test-api-key',
    });
  });

  afterEach(() => {
    sandbox.restore();
    mockFetch.resetHistory();
  });

  describe('constructor', () => {
    it('should initialize with API key', () => {
      expect(provider.apiKey).to.equal('test-api-key');
    });

    it('should use custom base URL', () => {
      const customProvider = new OpenAIProvider({
        apiKey: 'test-key',
        baseURL: 'https://custom.openai.com/v1',
      });
      expect(customProvider.baseURL).to.equal('https://custom.openai.com/v1');
    });

    it('should throw error without API key', () => {
      expect(() => new OpenAIProvider({})).to.throw('OpenAI API key is required');
    });
  });

  describe('getCapabilities', () => {
    it('should return provider capabilities', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities.provider).to.equal('openai');
      expect(capabilities.streaming).to.be.true;
      expect(capabilities.supportedModels).to.include('gpt-4');
      expect(capabilities.supportedModels).to.include('gpt-3.5-turbo');
      expect(capabilities.maxTokens).to.equal(8192);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', () => {
      const result = provider.checkRateLimit('user1', 60);
      expect(result).to.be.true;
    });

    it('should block requests exceeding limit', () => {
      // Fill rate limit
      for (let i = 0; i < 60; i++) {
        provider.checkRateLimit('user1', 60);
      }

      const result = provider.checkRateLimit('user1', 60);
      expect(result).to.be.false;
    });

    it('should handle different users separately', () => {
      // Fill rate limit for user1
      for (let i = 0; i < 60; i++) {
        provider.checkRateLimit('user1', 60);
      }

      // user2 should still be allowed
      const result = provider.checkRateLimit('user2', 60);
      expect(result).to.be.true;
    });
  });

  describe('streamCompletion', () => {
    it('should stream completion successfully', async () => {
      let readCount = 0;
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: () => {
              if (readCount === 0) {
                readCount += 1;
                return Promise.resolve({
                  done: false,
                  value: new TextEncoder().encode(
                    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
                  ),
                });
              }
              return Promise.resolve({ done: true, value: null });
            },
            releaseLock: () => {},
          }),
        },
      };

      mockFetch.resolves(mockResponse);

      const params = {
        prompt: 'Say hello',
        model: 'gpt-3.5-turbo',
        maxTokens: 100,
        userId: 'user1',
      };

      const chunks = [];
      for await (const chunk of provider.streamCompletion(params)) {
        chunks.push(chunk);
      }

      expect(chunks).to.have.length(1);
      expect(chunks[0].content).to.equal('Hello');
      expect(mockFetch.calledOnce).to.be.true;

      const fetchCall = mockFetch.firstCall;
      expect(fetchCall.args[0]).to.include('chat/completions');
      expect(fetchCall.args[1].headers.Authorization).to.equal('Bearer test-api-key');
    });

    it('should handle array prompt (messages)', async () => {
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: null,
              }),
            releaseLock: () => {},
          }),
        },
      };

      mockFetch.resolves(mockResponse);

      const params = {
        prompt: [{ role: 'user', content: 'Hello' }],
        userId: 'user1',
      };

      const chunks = [];
      for await (const chunk of provider.streamCompletion(params)) {
        chunks.push(chunk);
      }

      const fetchCall = mockFetch.firstCall;
      const requestBody = JSON.parse(fetchCall.args[1].body);
      expect(requestBody.messages).to.deep.equal([{ role: 'user', content: 'Hello' }]);
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      };

      mockFetch.resolves(mockResponse);

      const params = {
        prompt: 'Test',
        userId: 'user1',
      };

      let error;
      try {
        for await (const _chunk of provider.streamCompletion(params)) {
          // Should not reach here but we need to consume the generator
          _chunk;
        }
      } catch (e) {
        error = e;
      }

      expect(error).to.exist;
      expect(error.message).to.include('401');
    });

    it('should respect rate limiting', async () => {
      // Fill rate limit
      for (let i = 0; i < 60; i++) {
        provider.checkRateLimit('user1', 60);
      }

      const params = {
        prompt: 'Test',
        userId: 'user1',
      };

      let error;
      try {
        for await (const _chunk of provider.streamCompletion(params)) {
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

  describe('completion', () => {
    it('should handle non-streaming completion', async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [
              {
                message: { content: 'Hello world' },
                finish_reason: 'stop',
              },
            ],
            usage: { total_tokens: 10 },
          }),
      };

      mockFetch.resolves(mockResponse);

      const params = {
        prompt: 'Say hello',
        model: 'gpt-3.5-turbo',
        userId: 'user1',
      };

      const result = await provider.completion(params);

      expect(result.content).to.equal('Hello world');
      expect(result.finishReason).to.equal('stop');
      expect(result.usage.total_tokens).to.equal(10);
    });

    it('should handle empty response', async () => {
      const mockResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{}],
          }),
      };

      mockFetch.resolves(mockResponse);

      const params = {
        prompt: 'Test',
        userId: 'user1',
      };

      const result = await provider.completion(params);

      expect(result.content).to.equal('');
    });
  });

  describe('generateCacheKey', () => {
    it('should generate consistent cache key', () => {
      const params1 = {
        model: 'gpt-3.5-turbo',
        prompt: 'Hello',
        maxTokens: 100,
        temperature: 0.7,
      };

      const params2 = {
        model: 'gpt-3.5-turbo',
        prompt: 'Hello',
        maxTokens: 100,
        temperature: 0.7,
      };

      const key1 = provider.generateCacheKey(params1);
      const key2 = provider.generateCacheKey(params2);

      expect(key1).to.equal(key2);
      expect(key1).to.be.a('string');
      expect(key1).to.have.length(64); // SHA256 hex length
    });

    it('should generate different keys for different params', () => {
      const params1 = { model: 'gpt-3.5-turbo', prompt: 'Hello' };
      const params2 = { model: 'gpt-4', prompt: 'Hello' };

      const key1 = provider.generateCacheKey(params1);
      const key2 = provider.generateCacheKey(params2);

      expect(key1).to.not.equal(key2);
    });
  });
});
