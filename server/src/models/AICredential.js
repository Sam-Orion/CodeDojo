const mongoose = require('mongoose');
const crypto = require('crypto');

const aiCredentialSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ['openai', 'anthropic', 'azure-openai', 'gemini'],
      index: true,
    },
    encryptedApiKey: {
      type: String,
      required: true,
    },
    encryptedApiKeyIv: {
      type: String,
      required: true,
    },
    encryptedApiTag: {
      type: String,
      required: true,
    },
    keyId: {
      type: String,
      required: true,
      unique: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
    },
    metadata: {
      model: String,
      baseURL: String,
      organization: String,
      [String]: mongoose.Schema.Types.Mixed,
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

// Index for efficient lookup
aiCredentialSchema.index({ userId: 1, provider: 1, isActive: 1 });

// Encryption helpers
class CredentialEncryption {
  constructor() {
    // In production, this should be stored securely (e.g., AWS KMS, HashiCorp Vault)
    // For now, using environment variable with fallback to generated key
    this.algorithm = 'aes-256-gcm';
    this.secretKey = this.getOrCreateSecretKey();
  }

  getOrCreateSecretKey() {
    // Try to get from environment first
    if (process.env.AI_ENCRYPTION_KEY) {
      return Buffer.from(process.env.AI_ENCRYPTION_KEY, 'hex');
    }

    // For development, generate a consistent key
    // WARNING: This is not secure for production!
    if (process.env.NODE_ENV === 'development') {
      const fallbackKey = 'dev-key-32-bytes-long-for-ai-creds';
      return crypto.createHash('sha256').update(fallbackKey).digest();
    }

    throw new Error('AI_ENCRYPTION_KEY environment variable is required in production');
  }

  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.secretKey);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: '', // Not used with CBC
    };
  }

  decrypt(encryptedData, _iv) {
    const decipher = crypto.createDecipher('aes-256-cbc', this.secretKey);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

const encryption = new CredentialEncryption();

// Instance methods
aiCredentialSchema.methods.getApiKey = function () {
  try {
    return encryption.decrypt(this.encryptedApiKey, this.encryptedApiKeyIv);
  } catch (error) {
    throw new Error(`Failed to decrypt API key: ${error.message}`);
  }
};

aiCredentialSchema.methods.setApiKey = function (apiKey) {
  const encrypted = encryption.encrypt(apiKey);
  this.encryptedApiKey = encrypted.encrypted;
  this.encryptedApiKeyIv = encrypted.iv;
  this.encryptedApiTag = encrypted.authTag;
};

aiCredentialSchema.methods.incrementUsage = function () {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  return this.save();
};

// Static methods
aiCredentialSchema.statics.findByUserAndProvider = function (userId, provider, isActive = true) {
  return this.findOne({
    userId,
    provider,
    isActive,
  });
};

aiCredentialSchema.statics.findByUser = function (userId, isActive = true) {
  return this.find({
    userId,
    isActive,
  }).select('-encryptedApiKey -encryptedApiKeyIv -encryptedApiTag');
};

aiCredentialSchema.statics.createCredential = function (
  userId,
  provider,
  apiKey,
  displayName,
  metadata = {}
) {
  const credential = new this({
    userId,
    provider,
    displayName,
    keyId: crypto.randomUUID(),
    metadata,
  });

  credential.setApiKey(apiKey);
  return credential.save();
};

// Pre-save middleware
aiCredentialSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('AICredential', aiCredentialSchema);
