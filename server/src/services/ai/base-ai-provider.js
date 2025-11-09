const crypto = require('crypto');

/**
 * Base class for AI providers with streaming support
 */
class BaseAIProvider {
  constructor(config) {
    this.config = config;
    this.rateLimiter = new Map(); // Simple in-memory rate limiting
  }

  /**
   * Check rate limit for a user/session
   * @param {string} identifier - User ID or session ID
   * @param {number} limit - Requests per minute
   * @returns {boolean} - Whether request is allowed
   */
  checkRateLimit(identifier, limit = 60) {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window

    if (!this.rateLimiter.has(identifier)) {
      this.rateLimiter.set(identifier, []);
    }

    const requests = this.rateLimiter.get(identifier);
    // Remove old requests outside the window
    const validRequests = requests.filter((time) => time > windowStart);

    if (validRequests.length >= limit) {
      return false;
    }

    validRequests.push(now);
    this.rateLimiter.set(identifier, validRequests);
    return true;
  }

  /**
   * Generate cache key for a request
   * @param {Object} params - Request parameters
   * @returns {string} - Cache key
   */
  generateCacheKey(params) {
    const keyData = {
      provider: this.constructor.name,
      model: params.model,
      prompt: params.prompt,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
    };
    return crypto.createHash('sha256').update(JSON.stringify(keyData)).digest('hex');
  }

  /**
   * Abstract method to be implemented by providers
   */
  async *streamCompletion(_params) {
    // This is a generator function, but the actual implementation
    // will be provided by concrete classes
    yield; // Placeholder to satisfy linter
    throw new Error('streamCompletion must be implemented by provider');
  }

  /**
   * Abstract method to validate configuration
   */
  validateConfig() {
    throw new Error('validateConfig must be implemented by provider');
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return {
      streaming: true,
      maxTokens: 4096,
      supportedModels: [],
      features: ['completion', 'chat', 'code-suggestion'],
    };
  }
}

module.exports = BaseAIProvider;
