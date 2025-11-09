const { expect } = require('chai');
const sinon = require('sinon');

// Mock dependencies before importing
const mockFetch = sinon.stub();
global.fetch = mockFetch;

const GeminiProvider = require('../src/services/ai/gemini.provider');

describe('Gemini Provider', () => {
  let provider;
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    provider = new GeminiProvider({
      apiKey: 'test-gemini-key',
    });
  });

  afterEach(() => {
    sandbox.restore();
    mockFetch.resetHistory();
  });

  describe('constructor', () => {
    it('should initialize with API key and defaults', () => {
      expect(provider.apiKey).to.equal('test-gemini-key');
      expect(provider.baseURL).to.equal('https://generativelanguage.googleapis.com/v1beta');
      expect(provider.model).to.equal('gemini-1.5-flash-latest');
    });

    it('should support custom configuration', () => {
      const customProvider = new GeminiProvider({
        apiKey: 'custom-key',
        baseURL: 'https://custom.googleapis.com',
        model: 'gemini-pro-custom',
      });

      expect(customProvider.baseURL).to.equal('https://custom.googleapis.com');
      expect(customProvider.model).to.equal('gemini-pro-custom');
    });

    it('should throw error without API key', () => {
      expect(() => new GeminiProvider({})).to.throw('Gemini API key is required');
    });
  });

  describe('getCapabilities', () => {
    it('should return provider capabilities', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities.provider).to.equal('gemini');
      expect(capabilities.streaming).to.be.true;
      expect(capabilities.supportedModels).to.include('gemini-1.5-flash-latest');
      expect(capabilities.maxTokens).to.equal(8192);
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
                    `{"candidates":[{"content":{"parts":[{"text":"Hello"},{"text":" world"}]},"finishReason":"STOP"}],"usageMetadata":{"totalTokenCount":12}}\n`
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
        model: 'gemini-1.5-flash-latest',
        maxTokens: 128,
        userId: 'user-gemini',
      };

      const chunks = [];
      for await (const chunk of provider.streamCompletion(params)) {
        chunks.push(chunk);
      }

      expect(chunks).to.have.length(2);
      expect(chunks[0].content).to.equal('Hello');
      expect(chunks[1].content).to.equal(' world');
      expect(chunks[1].finishReason).to.equal('STOP');

      const fetchCall = mockFetch.firstCall;
      expect(fetchCall.args[0]).to.include('streamGenerateContent');
      const requestBody = JSON.parse(fetchCall.args[1].body);
      expect(requestBody.contents[0].parts[0].text).to.equal('Say hello');
      expect(requestBody.generationConfig.maxOutputTokens).to.equal(128);
    });

    it('should handle array prompt (messages)', async () => {
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: () => Promise.resolve({ done: true, value: null }),
            releaseLock: () => {},
          }),
        },
      };

      mockFetch.resolves(mockResponse);

      const params = {
        prompt: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Explain closures.' },
        ],
        userId: 'user-gemini',
      };

      for await (const chunk of provider.streamCompletion(params)) {
        // consume generator (expected empty)
        chunk;
      }

      const requestBody = JSON.parse(mockFetch.firstCall.args[1].body);
      expect(requestBody.contents).to.have.length(2);
      expect(requestBody.contents[0].role).to.equal('user');
      expect(requestBody.contents[1].role).to.equal('user');
      expect(requestBody.contents[1].parts[0].text).to.equal('Explain closures.');
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        text: () => Promise.resolve('Permission denied'),
      };

      mockFetch.resolves(mockResponse);

      let error;
      try {
        for await (const _chunk of provider.streamCompletion({ prompt: 'Hi', userId: 'user1' })) {
          _chunk;
        }
      } catch (err) {
        error = err;
      }

      expect(error).to.exist;
      expect(error.message).to.include('403');
    });

    it('should respect rate limiting', async () => {
      for (let i = 0; i < 60; i++) {
        provider.checkRateLimit('user1', 60);
      }

      let error;
      try {
        for await (const _chunk of provider.streamCompletion({ prompt: 'Hi', userId: 'user1' })) {
          _chunk;
        }
      } catch (err) {
        error = err;
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
            candidates: [
              {
                content: {
                  parts: [{ text: 'function hello() {}' }],
                },
                finishReason: 'STOP',
              },
            ],
            usageMetadata: {
              totalTokenCount: 42,
            },
          }),
      };

      mockFetch.resolves(mockResponse);

      const result = await provider.completion({
        prompt: 'Write a function',
        userId: 'user1',
      });

      expect(result.content).to.equal('function hello() {}');
      expect(result.finishReason).to.equal('STOP');
      expect(result.usage.totalTokenCount).to.equal(42);
    });
  });
});
