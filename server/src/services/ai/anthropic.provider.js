const BaseAIProvider = require('./base-ai-provider');
const { logger } = require('../../utils/logger');

/**
 * Anthropic Claude AI Provider implementation
 */
class AnthropicProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.anthropic.com';
    this.validateConfig();
  }

  validateConfig() {
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required');
    }
  }

  getCapabilities() {
    return {
      ...super.getCapabilities(),
      supportedModels: [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        'claude-2.1',
        'claude-2.0',
        'claude-instant-1.2',
      ],
      maxTokens: 4096,
      provider: 'anthropic',
    };
  }

  async *streamCompletion(params) {
    const {
      prompt,
      model = 'claude-3-haiku-20240307',
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

    // Convert OpenAI-style messages to Claude format
    let messages;
    if (Array.isArray(prompt)) {
      messages = prompt.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));
    } else {
      messages = [{ role: 'user', content: prompt }];
    }

    const requestBody = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
    };

    if (stop) {
      requestBody.stop_sequences = Array.isArray(stop) ? stop : [stop];
    }

    logger.debug('Anthropic streaming request', { model, maxTokens, userId });

    try {
      const response = await fetch(`${this.baseURL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Anthropic API error', { status: response.status, error, userId });
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
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
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine === 'event: message_stop') continue;

            if (trimmedLine.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmedLine.slice(6));
                if (data.type === 'content_block_delta' && data.delta?.text) {
                  yield {
                    content: data.delta.text,
                    finishReason: data.type === 'message_stop' ? 'stop' : null,
                    usage: data.usage,
                  };
                }
              } catch (parseError) {
                logger.warn('Failed to parse Anthropic SSE data', {
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
      logger.error('Anthropic streaming error', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Non-streaming completion for fallback
   */
  async completion(params) {
    const {
      prompt,
      model = 'claude-3-haiku-20240307',
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

    // Convert OpenAI-style messages to Claude format
    let messages;
    if (Array.isArray(prompt)) {
      messages = prompt.map((msg) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      }));
    } else {
      messages = [{ role: 'user', content: prompt }];
    }

    const requestBody = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    };

    if (stop) {
      requestBody.stop_sequences = Array.isArray(stop) ? stop : [stop];
    }

    logger.debug('Anthropic completion request', { model, maxTokens, userId });

    try {
      const response = await fetch(`${this.baseURL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        logger.error('Anthropic API error', { status: response.status, error, userId });
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      return {
        content: data.content?.[0]?.text || '',
        finishReason: data.stop_reason,
        usage: data.usage,
      };
    } catch (error) {
      logger.error('Anthropic completion error', { error: error.message, userId });
      throw error;
    }
  }
}

module.exports = AnthropicProvider;
