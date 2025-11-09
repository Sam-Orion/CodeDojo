const mongoose = require('mongoose');
const crypto = require('crypto');

const storageCredentialSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ['local', 'google-drive', 'onedrive'],
      index: true,
    },
    encryptedRefreshToken: {
      type: String,
      default: null,
    },
    encryptedRefreshTokenIv: {
      type: String,
      default: null,
    },
    encryptedRefreshTokenTag: {
      type: String,
      default: null,
    },
    encryptedAccessToken: {
      type: String,
      default: null,
    },
    accessTokenExpiry: {
      type: Date,
      default: null,
    },
    displayName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    metadata: {
      storageQuota: Number,
      storageUsed: Number,
      accountType: String,
      [String]: mongoose.Schema.Types.Mixed,
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user + provider
storageCredentialSchema.index({ userId: 1, provider: 1 });
storageCredentialSchema.index({ userId: 1, isActive: 1, isDefault: 1 });

// Encryption helpers
class CredentialEncryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.secretKey = this.getOrCreateSecretKey();
  }

  getOrCreateSecretKey() {
    if (process.env.STORAGE_ENCRYPTION_KEY) {
      return Buffer.from(process.env.STORAGE_ENCRYPTION_KEY, 'hex');
    }

    if (process.env.NODE_ENV === 'development') {
      const fallbackKey = 'dev-key-32-bytes-long-for-storage';
      return crypto.createHash('sha256').update(fallbackKey).digest();
    }

    throw new Error('STORAGE_ENCRYPTION_KEY environment variable is required in production');
  }

  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  decrypt(encryptedData, iv, authTag) {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.secretKey,
      Buffer.from(iv, 'hex')
    );

    if (authTag) {
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    }

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

const encryption = new CredentialEncryption();

// Instance methods
storageCredentialSchema.methods.getRefreshToken = function () {
  if (!this.encryptedRefreshToken) {
    return null;
  }
  try {
    return encryption.decrypt(
      this.encryptedRefreshToken,
      this.encryptedRefreshTokenIv,
      this.encryptedRefreshTokenTag
    );
  } catch (error) {
    throw new Error(`Failed to decrypt refresh token: ${error.message}`);
  }
};

storageCredentialSchema.methods.setRefreshToken = function (token) {
  if (!token) {
    this.encryptedRefreshToken = null;
    this.encryptedRefreshTokenIv = null;
    this.encryptedRefreshTokenTag = null;
    return;
  }

  const encrypted = encryption.encrypt(token);
  this.encryptedRefreshToken = encrypted.encrypted;
  this.encryptedRefreshTokenIv = encrypted.iv;
  this.encryptedRefreshTokenTag = encrypted.authTag;
};

storageCredentialSchema.methods.getAccessToken = function () {
  if (!this.encryptedAccessToken) {
    return null;
  }
  try {
    return encryption.decrypt(this.encryptedAccessToken, '', '');
  } catch (error) {
    throw new Error(`Failed to decrypt access token: ${error.message}`);
  }
};

storageCredentialSchema.methods.setAccessToken = function (token, expirySeconds = 3600) {
  const encrypted = encryption.encrypt(token);
  this.encryptedAccessToken = encrypted.encrypted;
  this.accessTokenExpiry = new Date(Date.now() + expirySeconds * 1000);
};

storageCredentialSchema.methods.isAccessTokenExpired = function () {
  if (!this.accessTokenExpiry) {
    return true;
  }
  return new Date() >= this.accessTokenExpiry;
};

// Static methods
storageCredentialSchema.statics.findByUserAndProvider = function (
  userId,
  provider,
  isActive = true
) {
  return this.findOne({
    userId,
    provider,
    isActive,
  });
};

storageCredentialSchema.statics.findByUser = function (userId, isActive = true) {
  return this.find({
    userId,
    isActive,
  }).select(
    '-encryptedRefreshToken -encryptedRefreshTokenIv -encryptedRefreshTokenTag -encryptedAccessToken'
  );
};

storageCredentialSchema.statics.findDefaultForUser = function (userId) {
  return this.findOne({
    userId,
    isActive: true,
    isDefault: true,
  });
};

// Pre-save middleware
storageCredentialSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('StorageCredential', storageCredentialSchema);
