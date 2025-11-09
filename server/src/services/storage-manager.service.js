const { StorageCredential, StorageFileAudit } = require('../models');
const providerRegistry = require('./storage/provider-registry');
const logger = require('../utils/logger');

class StorageManagerService {
  async getProvider(userId, providerName) {
    try {
      const credential = await StorageCredential.findByUserAndProvider(userId, providerName);

      if (!credential) {
        throw new Error(`No credentials found for provider: ${providerName}`);
      }

      // Refresh token if needed for cloud providers
      if (
        (providerName === 'google-drive' || providerName === 'onedrive') &&
        credential.isAccessTokenExpired()
      ) {
        await this.refreshCredential(credential);
      }

      const provider = providerRegistry.createProvider(providerName, {
        accessToken: credential.getAccessToken ? credential.getAccessToken() : null,
        refreshToken: credential.getRefreshToken ? credential.getRefreshToken() : null,
        clientId: process.env[`${providerName.toUpperCase().replace('-', '_')}_CLIENT_ID`],
        clientSecret: process.env[`${providerName.toUpperCase().replace('-', '_')}_CLIENT_SECRET`],
        redirectUrl: process.env[`${providerName.toUpperCase().replace('-', '_')}_REDIRECT_URL`],
        basePath: process.env.STORAGE_BASE_PATH,
      });

      return provider;
    } catch (error) {
      logger.error('Error getting provider', { userId, providerName, error: error.message });
      throw error;
    }
  }

  async refreshCredential(credential) {
    try {
      const provider = providerRegistry.createProvider(credential.provider, {
        refreshToken: credential.getRefreshToken?.(),
        clientId: process.env[`${credential.provider.toUpperCase().replace('-', '_')}_CLIENT_ID`],
        clientSecret:
          process.env[`${credential.provider.toUpperCase().replace('-', '_')}_CLIENT_SECRET`],
        redirectUrl:
          process.env[`${credential.provider.toUpperCase().replace('-', '_')}_REDIRECT_URL`],
      });

      const refreshed = await provider.refreshAuth();
      credential.setAccessToken(refreshed.accessToken);
      await credential.save();

      logger.info('Credential refreshed', {
        userId: credential.userId,
        provider: credential.provider,
      });
    } catch (error) {
      logger.error('Error refreshing credential', {
        userId: credential.userId,
        provider: credential.provider,
        error: error.message,
      });
      throw error;
    }
  }

  async auditAction(
    userId,
    provider,
    action,
    filePath,
    fileName,
    status = 'success',
    error = null,
    metadata = {}
  ) {
    try {
      await StorageFileAudit.create({
        userId,
        provider,
        action,
        filePath,
        fileName,
        status,
        errorMessage: error?.message || null,
        metadata: {
          correlationId: metadata.correlationId,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          ...metadata,
        },
      });
    } catch (err) {
      logger.error('Error creating audit log', {
        userId,
        provider,
        action,
        error: err.message,
      });
    }
  }

  async getUserProviders(userId) {
    try {
      const credentials = await StorageCredential.findByUser(userId, true);
      return credentials.map((cred) => ({
        id: cred._id,
        provider: cred.provider,
        displayName: cred.displayName,
        email: cred.email,
        isDefault: cred.isDefault,
        isActive: cred.isActive,
        metadata: cred.metadata,
        lastSyncedAt: cred.lastSyncedAt,
        createdAt: cred.createdAt,
      }));
    } catch (error) {
      logger.error('Error getting user providers', { userId, error: error.message });
      throw error;
    }
  }

  async setDefaultProvider(userId, credentialId) {
    try {
      // Clear existing default
      await StorageCredential.updateMany({ userId, isDefault: true }, { isDefault: false });

      // Set new default
      await StorageCredential.findByIdAndUpdate(credentialId, { isDefault: true });

      logger.info('Default provider set', { userId, credentialId });
    } catch (error) {
      logger.error('Error setting default provider', {
        userId,
        credentialId,
        error: error.message,
      });
      throw error;
    }
  }

  async getDefaultProvider(userId) {
    try {
      const credential = await StorageCredential.findDefaultForUser(userId);

      if (!credential) {
        // Return local as default if no provider is set
        return {
          provider: 'local',
          displayName: 'Local Storage',
          isDefault: true,
        };
      }

      return {
        id: credential._id,
        provider: credential.provider,
        displayName: credential.displayName,
        isDefault: true,
      };
    } catch (error) {
      logger.error('Error getting default provider', { userId, error: error.message });
      throw error;
    }
  }

  async unlinkProvider(userId, credentialId) {
    try {
      const credential = await StorageCredential.findOne({
        _id: credentialId,
        userId,
      });

      if (!credential) {
        throw new Error('Credential not found');
      }

      await StorageCredential.deleteOne({ _id: credentialId });

      logger.info('Provider unlinked', {
        userId,
        provider: credential.provider,
        credentialId,
      });

      return true;
    } catch (error) {
      logger.error('Error unlinking provider', { userId, credentialId, error: error.message });
      throw error;
    }
  }

  async getAuditLogs(userId, options = {}) {
    try {
      const query = { userId };

      if (options.provider) {
        query.provider = options.provider;
      }

      if (options.action) {
        query.action = options.action;
      }

      if (options.startDate || options.endDate) {
        query.createdAt = {};
        if (options.startDate) {
          query.createdAt.$gte = new Date(options.startDate);
        }
        if (options.endDate) {
          query.createdAt.$lte = new Date(options.endDate);
        }
      }

      const logs = await StorageFileAudit.find(query)
        .sort({ createdAt: -1 })
        .limit(options.limit || 100)
        .skip(options.offset || 0);

      const total = await StorageFileAudit.countDocuments(query);

      return {
        logs,
        total,
        limit: options.limit || 100,
        offset: options.offset || 0,
      };
    } catch (error) {
      logger.error('Error getting audit logs', { userId, error: error.message });
      throw error;
    }
  }

  async listProviders() {
    return providerRegistry.getAvailableProviders();
  }
}

module.exports = new StorageManagerService();
