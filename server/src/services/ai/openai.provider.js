const BaseAIProvider = require('./base-ai-provider');
const { logger } = require('../../utils/logger');

/**
 * OpenAI AI Provider implementation
 */
class OpenAIProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    this.validateConfig();
  }

  validateConfig() {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportedModels: [
        'gpt-4',
        'gpt-4-turbo',
        'gpt-3.5-turbo',
        'gpt-3.5-turbo-16k',
        'text-davinci-003',
        'text-davinci-002',
      ],
      maxTokens: 8192,
      provider: 'openai',
    };
  }

  async *streamCompletion(params) {
    const {
      prompt,
      model = 'gpt-3.5-turbo',
      maxTokens = 1000,
      temperature = 0.7,
      stop = null,
      userId,
      sessionId,
    } = params;

    // Rate limiting check
    if (!this.checkRateLimit(userId || sessionId)) {
      throw new Error('Rate limit exceeded');
    }

    const requestBody = {
      model,
      messages: Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
      stream: true,
    };

    if (stop) {
      requestBody.stop = stop;
    }

    logger.debug('OpenAI streaming request', { model, maxTokens, userId });

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('OpenAI API error', { status: response.status, error, userId });
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

            if (trimmedLine.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmedLine.slice(6));
                if (data.choices && data.choices[0]?.delta?.content) {
                  yield {
                    content: data.choices[0].delta.content,
                    finishReason: data.choices[0].finish_reason,
                    usage: data.usage,
                  };
                }
              } catch (parseError) {
                logger.warn('Failed to parse OpenAI SSE data', {
                  line: trimmedLine,
                  error: parseError.message,
                });
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      logger.error('OpenAI streaming error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Non-streaming completion for fallback
   */
  async completion(params) {
    const {
      prompt,
      model = 'gpt-3.5-turbo',
      maxTokens = 1000,
      temperature = 0.7,
      stop = null,
      userId,
      sessionId,
    } = params;

    // Rate limiting check
    if (!this.checkRateLimit(userId || sessionId)) {
      throw new Error('Rate limit exceeded');
    }

    const requestBody = {
      model,
      messages: Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature,
    };

    if (stop) {
      requestBody.stop = stop;
    }

    logger.debug('OpenAI completion request', { model, maxTokens, userId });

    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('OpenAI API error', { status: response.status, error, userId });
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      return {
        content: data.choices[0]?.message?.content || '',
        finishReason: data.choices[0]?.finish_reason,
        usage: data.usage,
      };
    } catch (error) {
      logger.error('OpenAI completion error', { error: error.message, userId });
      throw error;
    }
  }
}

module.exports = OpenAIProvider;
