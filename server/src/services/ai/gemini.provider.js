const BaseAIProvider = require('./base-ai-provider');
const logger = require('../../utils/logger');

/**
 * Google Gemini AI Provider implementation
 */
class GeminiProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://generativelanguage.googleapis.com/v1beta';
    this.model = config.model || 'gemini-1.5-flash-latest';
    this.validateConfig();
  }

  validateConfig() {
    if (!this.apiKey) {
      throw new Error('Gemini API key is required');
    }
  }

  getCapabilities() {
    return {
      ...super.getCapabilities(),
      provider: 'gemini',
      maxTokens: 8192,
      supportedModels: [
        'gemini-1.5-flash-latest',
        'gemini-1.5-pro-latest',
        'gemini-1.0-pro',
        'gemini-1.0-pro-001',
        'gemini-pro',
      ],
    };
  }

  buildContents(prompt) {
    if (Array.isArray(prompt)) {
      return prompt.map((message) => ({
        role: this.mapRole(message.role),
        parts: [{ text: message.content }],
      }));
    }

    return [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];
  }

  mapRole(role) {
    if (role === 'assistant') {
      return 'model';
    }
    if (role === 'system') {
      return 'user';
    }
    return role || 'user';
  }

  buildGenerationConfig({ maxTokens, temperature, stop }) {
    const config = {};

    if (typeof temperature === 'number') {
      config.temperature = temperature;
    }

    if (typeof maxTokens === 'number') {
      config.maxOutputTokens = maxTokens;
    }

    if (stop) {
      config.stopSequences = Array.isArray(stop) ? stop : [stop];
    }

    return config;
  }

  extractTextFromCandidate(candidate) {
    if (!candidate || !candidate.content || !Array.isArray(candidate.content.parts)) {
      return '';
    }

    return candidate.content.parts.map((part) => part.text || '').join('');
  }

  async *streamCompletion(params) {
    const {
      prompt,
      model = this.model,
      maxTokens = 1024,
      temperature = 0.7,
      stop = null,
      userId,
      sessionId,
    } = params;

    if (!this.checkRateLimit(userId || sessionId)) {
      throw new Error('Rate limit exceeded');
    }

    const url = `${this.baseURL}/models/${model}:streamGenerateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: this.buildContents(prompt),
      generationConfig: this.buildGenerationConfig({ maxTokens, temperature, stop }),
    };

    logger.debug('Gemini streaming request', { model, maxTokens, userId });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Gemini API error', { status: response.status, error, userId });
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let newlineIndex = buffer.indexOf('\n');

        while (newlineIndex !== -1) {
          const rawChunk = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf('\n');

          if (!rawChunk) {
            continue;
          }

          try {
            const payload = JSON.parse(rawChunk);
            usage = payload.usageMetadata || usage;
            const candidate = payload.candidates && payload.candidates[0];

            if (candidate && candidate.content && Array.isArray(candidate.content.parts)) {
              const finishReason = candidate.finishReason || null;
              for (const part of candidate.content.parts) {
                if (part.text) {
                  yield {
                    content: part.text,
                    finishReason,
                    usage,
                  };
                }
              }
            }
          } catch (error) {
            logger.warn('Failed to parse Gemini stream chunk', {
              chunk: rawChunk,
              error: error.message,
            });
          }
        }
      }

      if (buffer.trim()) {
        try {
          const payload = JSON.parse(buffer.trim());
          usage = payload.usageMetadata || usage;
          const candidate = payload.candidates && payload.candidates[0];
          if (candidate && candidate.content && Array.isArray(candidate.content.parts)) {
            const finishReason = candidate.finishReason || null;
            for (const part of candidate.content.parts) {
              if (part.text) {
                yield {
                  content: part.text,
                  finishReason,
                  usage,
                };
              }
            }
          }
        } catch (error) {
          logger.warn('Failed to parse Gemini trailing chunk', {
            chunk: buffer,
            error: error.message,
          });
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async completion(params) {
    const {
      prompt,
      model = this.model,
      maxTokens = 1024,
      temperature = 0.7,
      stop = null,
      userId,
      sessionId,
    } = params;

    if (!this.checkRateLimit(userId || sessionId)) {
      throw new Error('Rate limit exceeded');
    }

    const url = `${this.baseURL}/models/${model}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: this.buildContents(prompt),
      generationConfig: this.buildGenerationConfig({ maxTokens, temperature, stop }),
    };

    logger.debug('Gemini completion request', { model, maxTokens, userId });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Gemini API error', { status: response.status, error, userId });
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const candidate = data.candidates && data.candidates[0];
    const content = this.extractTextFromCandidate(candidate);

    return {
      content,
      finishReason: candidate?.finishReason || null,
      usage: data.usageMetadata,
    };
  }
}

module.exports = GeminiProvider;
