const { AICredential } = require('../models');
const { logger } = require('../utils/logger');
const { asyncHandler } = require('../utils/async-handler');

/**
 * Create new AI credential
 */
const createCredential = asyncHandler(async (req, res) => {
  const { provider, apiKey, displayName, metadata = {} } = req.body;
  const userId = req.user?.id || req.body.userId;

  if (!userId || !provider || !apiKey || !displayName) {
    return res.status(400).json({
      error: 'userId, provider, apiKey, and displayName are required',
    });
  }

  // Validate provider
  const validProviders = ['openai', 'anthropic', 'azure-openai'];
  if (!validProviders.includes(provider)) {
    return res.status(400).json({
      error: `Invalid provider. Must be one of: ${validProviders.join(', ')}`,
    });
  }

  // Check if credential already exists for this user and provider
  const existing = await AICredential.findByUserAndProvider(userId, provider);
  if (existing) {
    return res.status(409).json({
      error: `Credential for ${provider} already exists. Update it instead.`,
    });
  }

  // Create new credential
  const credential = await AICredential.createCredential(
    userId,
    provider,
    apiKey,
    displayName,
    metadata
  );

  logger.info('AI credential created', {
    userId,
    provider,
    keyId: credential.keyId,
    displayName,
  });

  // Return credential without sensitive data
  const response = credential.toObject();
  delete response.encryptedApiKey;
  delete response.encryptedApiKeyIv;
  delete response.encryptedApiTag;

  res.status(201).json(response);
});

/**
 * Get user's credentials
 */
const getCredentials = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.query.userId;

  if (!userId) {
    return res.status(400).json({
      error: 'userId is required',
    });
  }

  const credentials = await AICredential.findByUser(userId);

  res.json({
    credentials,
    count: credentials.length,
  });
});

/**
 * Get specific credential
 */
const getCredential = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const credential = await AICredential.findOne({
    _id: id,
    userId,
  });

  if (!credential) {
    return res.status(404).json({
      error: 'Credential not found',
    });
  }

  // Return without sensitive data
  const response = credential.toObject();
  delete response.encryptedApiKey;
  delete response.encryptedApiKeyIv;
  delete response.encryptedApiTag;

  res.json(response);
});

/**
 * Update credential
 */
const updateCredential = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { displayName, metadata, isActive, apiKey } = req.body;
  const userId = req.user?.id;

  const credential = await AICredential.findOne({
    _id: id,
    userId,
  });

  if (!credential) {
    return res.status(404).json({
      error: 'Credential not found',
    });
  }

  // Update fields
  if (displayName !== undefined) credential.displayName = displayName;
  if (metadata !== undefined) credential.metadata = { ...credential.metadata, ...metadata };
  if (isActive !== undefined) credential.isActive = isActive;
  if (apiKey !== undefined) credential.setApiKey(apiKey);

  await credential.save();

  logger.info('AI credential updated', {
    userId,
    provider: credential.provider,
    keyId: credential.keyId,
    updates: Object.keys(req.body),
  });

  // Return without sensitive data
  const response = credential.toObject();
  delete response.encryptedApiKey;
  delete response.encryptedApiKeyIv;
  delete response.encryptedApiTag;

  res.json(response);
});

/**
 * Delete credential
 */
const deleteCredential = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const credential = await AICredential.findOne({
    _id: id,
    userId,
  });

  if (!credential) {
    return res.status(404).json({
      error: 'Credential not found',
    });
  }

  await AICredential.deleteOne({ _id: id });

  logger.info('AI credential deleted', {
    userId,
    provider: credential.provider,
    keyId: credential.keyId,
  });

  res.json({ success: true });
});

/**
 * Test credential validity
 */
const testCredential = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const credential = await AICredential.findOne({
    _id: id,
    userId,
    isActive: true,
  });

  if (!credential) {
    return res.status(404).json({
      error: 'Credential not found or inactive',
    });
  }

  try {
    // Test the credential by making a simple API call
    let provider;

    if (credential.provider === 'openai') {
      const OpenAIProvider = require('../services/ai/openai.provider');
      provider = new OpenAIProvider({
        apiKey: credential.getApiKey(),
        ...credential.metadata,
      });
    } else if (credential.provider === 'anthropic') {
      const AnthropicProvider = require('../services/ai/anthropic.provider');
      provider = new AnthropicProvider({
        apiKey: credential.getApiKey(),
        ...credential.metadata,
      });
    } else {
      return res.status(400).json({
        error: `Provider ${credential.provider} not supported for testing`,
      });
    }

    // Make a simple completion request to test
    const testPrompt = 'Say "Hello World"';
    const result = await provider.completion({
      prompt: testPrompt,
      maxTokens: 10,
      userId: 'test',
    });

    logger.info('AI credential test successful', {
      userId,
      provider: credential.provider,
      keyId: credential.keyId,
    });

    res.json({
      success: true,
      provider: credential.provider,
      testResponse: result.content?.slice(0, 50),
    });
  } catch (error) {
    logger.error('AI credential test failed', {
      userId,
      provider: credential.provider,
      keyId: credential.keyId,
      error: error.message,
    });

    res.status(400).json({
      success: false,
      error: `Credential test failed: ${error.message}`,
    });
  }
});

/**
 * Get credential usage statistics
 */
const getCredentialStats = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.query.userId;

  if (!userId) {
    return res.status(400).json({
      error: 'userId is required',
    });
  }

  const credentials = await AICredential.find({ userId }).select(
    'provider displayName usageCount lastUsedAt createdAt isActive'
  );

  const stats = {
    totalCredentials: credentials.length,
    activeCredentials: credentials.filter((c) => c.isActive).length,
    totalUsage: credentials.reduce((sum, c) => sum + c.usageCount, 0),
    byProvider: {},
    credentials: credentials,
  };

  // Group by provider
  credentials.forEach((cred) => {
    if (!stats.byProvider[cred.provider]) {
      stats.byProvider[cred.provider] = {
        count: 0,
        usage: 0,
      };
    }
    stats.byProvider[cred.provider].count++;
    stats.byProvider[cred.provider].usage += cred.usageCount;
  });

  res.json(stats);
});

module.exports = {
  createCredential,
  getCredentials,
  getCredential,
  updateCredential,
  deleteCredential,
  testCredential,
  getCredentialStats,
};
