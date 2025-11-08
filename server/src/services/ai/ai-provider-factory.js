const OpenAIProvider = require('./openai.provider');
const AnthropicProvider = require('./anthropic.provider');
const { logger } = require('../../utils/logger');

/**
 * AI Provider Factory for managing different AI providers
 */
class AIProviderFactory {
  constructor() {
    this.providers = new Map();
    this.defaultProvider = null;
  }

  /**
   * Register a provider instance
   * @param {string} name - Provider name
   * @param {BaseAIProvider} provider - Provider instance
   * @param {boolean} isDefault - Whether this is the default provider
   */
  registerProvider(name, provider, isDefault = false) {
    this.providers.set(name, provider);
    if (isDefault || !this.defaultProvider) {
      this.defaultProvider = name;
    }
    logger.info(`Registered AI provider: ${name}${isDefault ? ' (default)' : ''}`);
  }

  /**
   * Create and register OpenAI provider
   * @param {Object} config - OpenAI configuration
   * @param {boolean} isDefault - Whether this is the default provider
   */
  registerOpenAI(config, isDefault = false) {
    try {
      const provider = new OpenAIProvider(config);
      this.registerProvider('openai', provider, isDefault);
      return provider;
    } catch (error) {
      logger.error('Failed to register OpenAI provider', { error: error.message });
      throw error;
    }
  }

  /**
   * Create and register Anthropic provider
   * @param {Object} config - Anthropic configuration
   * @param {boolean} isDefault - Whether this is the default provider
   */
  registerAnthropic(config, isDefault = false) {
    try {
      const provider = new AnthropicProvider(config);
      this.registerProvider('anthropic', provider, isDefault);
      return provider;
    } catch (error) {
      logger.error('Failed to register Anthropic provider', { error: error.message });
      throw error;
    }
  }

  /**
   * Get a provider by name
   * @param {string} name - Provider name
   * @returns {BaseAIProvider} - Provider instance
   */
  getProvider(name = null) {
    const providerName = name || this.defaultProvider;
    if (!providerName) {
      throw new Error('No AI provider available and no default specified');
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`AI provider '${providerName}' not found`);
    }

    return provider;
  }

  /**
   * Get all available providers
   * @returns {Array} - Array of provider info
   */
  getAvailableProviders() {
    const providers = [];
    for (const [name, provider] of this.providers) {
      providers.push({
        name,
        capabilities: provider.getCapabilities(),
        isDefault: name === this.defaultProvider,
      });
    }
    return providers;
  }

  /**
   * Set default provider
   * @param {string} name - Provider name
   */
  setDefaultProvider(name) {
    if (!this.providers.has(name)) {
      throw new Error(`Provider '${name}' not found`);
    }
    this.defaultProvider = name;
    logger.info(`Set default AI provider: ${name}`);
  }

  /**
   * Check if provider exists
   * @param {string} name - Provider name
   * @returns {boolean} - Whether provider exists
   */
  hasProvider(name) {
    return this.providers.has(name);
  }

  /**
   * Remove a provider
   * @param {string} name - Provider name
   */
  removeProvider(name) {
    if (this.providers.has(name)) {
      this.providers.delete(name);
      if (this.defaultProvider === name) {
        this.defaultProvider = this.providers.size > 0 ? this.providers.keys().next().value : null;
      }
      logger.info(`Removed AI provider: ${name}`);
    }
  }
}

// Singleton instance
module.exports = new AIProviderFactory();
