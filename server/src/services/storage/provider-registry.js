const LocalStorageProvider = require('./local-provider');
const GoogleDriveProvider = require('./google-drive-provider');
const OneDriveProvider = require('./onedrive-provider');
const logger = require('../../utils/logger');

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    this.register('local', LocalStorageProvider);
    this.register('google-drive', GoogleDriveProvider);
    this.register('onedrive', OneDriveProvider);
  }

  register(providerName, ProviderClass) {
    if (this.providers.has(providerName)) {
      logger.warn(`Provider ${providerName} already registered, replacing`);
    }
    this.providers.set(providerName, ProviderClass);
    logger.info(`Storage provider registered: ${providerName}`);
  }

  createProvider(providerName, options = {}) {
    const ProviderClass = this.providers.get(providerName);
    if (!ProviderClass) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    const instance = new ProviderClass(options);
    logger.info(`Storage provider instance created: ${providerName}`);
    return instance;
  }

  getAvailableProviders() {
    return Array.from(this.providers.keys());
  }

  isProviderRegistered(providerName) {
    return this.providers.has(providerName);
  }
}

// Singleton instance
module.exports = new ProviderRegistry();
