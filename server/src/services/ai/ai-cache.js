const crypto = require('crypto');
const logger = require('../../utils/logger');

/**
 * Simple in-memory LRU cache for AI responses
 */
class AICache {
  constructor(maxSize = 100, ttlMs = 300000) {
    // 5 minutes default TTL
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cache = new Map();
    this.accessOrder = [];
  }

  /**
   * Generate cache key from request parameters
   * @param {Object} params - Request parameters
   * @returns {string} - Cache key
   */
  generateKey(params) {
    const keyData = {
      provider: params.provider,
      model: params.model,
      prompt: params.prompt,
      maxTokens: params.maxTokens,
      temperature: params.temperature,
      stop: params.stop,
    };
    return crypto.createHash('sha256').update(JSON.stringify(keyData)).digest('hex');
  }

  /**
   * Get cached response
   * @param {string} key - Cache key
   * @returns {Object|null} - Cached response or null
   */
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.delete(key);
      return null;
    }

    // Update access order
    this.updateAccessOrder(key);

    logger.debug('AI cache hit', { key });
    return entry.data;
  }

  /**
   * Set cache entry
   * @param {string} key - Cache key
   * @param {Object} data - Response data
   */
  set(key, data) {
    // Remove oldest if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.accessOrder.shift();
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    this.updateAccessOrder(key);
    logger.debug('AI cache set', { key });
  }

  /**
   * Delete cache entry
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Update access order for LRU
   * @param {string} key - Cache key
   */
  updateAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    logger.info('AI cache cleared');
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0,
      hitCount: this.hitCount || 0,
      missCount: this.missCount || 0,
    };
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttlMs) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => this.delete(key));

    if (expiredKeys.length > 0) {
      logger.debug('AI cache cleanup', { expiredCount: expiredKeys.length });
    }
  }
}

// Singleton instance
module.exports = new AICache();
