const { StorageCredential } = require('../models');
const storageManager = require('../services/storage-manager.service');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

const listProviders = asyncHandler(async (req, res) => {
  const providers = await storageManager.listProviders();

  res.json({
    providers,
    count: providers.length,
  });
});

const getUserProviders = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.query.userId;

  if (!userId) {
    return res.status(400).json({
      error: 'userId is required',
    });
  }

  const providers = await storageManager.getUserProviders(userId);

  res.json({
    providers,
    count: providers.length,
  });
});

const linkProvider = asyncHandler(async (req, res) => {
  const { provider, accessToken, refreshToken, displayName, email, metadata = {} } = req.body;
  const userId = req.user?.id || req.body.userId;

  if (!userId || !provider || !displayName) {
    return res.status(400).json({
      error: 'userId, provider, and displayName are required',
    });
  }

  const validProviders = ['local', 'google-drive', 'onedrive'];
  if (!validProviders.includes(provider)) {
    return res.status(400).json({
      error: `Invalid provider. Must be one of: ${validProviders.join(', ')}`,
    });
  }

  // Check if credential already exists
  const existing = await StorageCredential.findByUserAndProvider(userId, provider);
  if (existing && !req.body.replace) {
    return res.status(409).json({
      error: `Provider ${provider} is already linked. Use replace: true to overwrite.`,
    });
  }

  // Create or update credential
  let credential;
  if (existing) {
    credential = existing;
  } else {
    credential = new StorageCredential({
      userId,
      provider,
      displayName,
      email,
      metadata,
    });
  }

  if (accessToken) {
    credential.setAccessToken(accessToken);
  }

  if (refreshToken) {
    credential.setRefreshToken(refreshToken);
  }

  credential.displayName = displayName;
  if (email) {
    credential.email = email;
  }

  await credential.save();

  logger.info('Storage provider linked', {
    userId,
    provider,
    displayName,
  });

  const response = credential.toObject();
  delete response.encryptedRefreshToken;
  delete response.encryptedRefreshTokenIv;
  delete response.encryptedRefreshTokenTag;
  delete response.encryptedAccessToken;

  res.status(existing ? 200 : 201).json(response);
});

const unlinkProvider = asyncHandler(async (req, res) => {
  const { credentialId } = req.params;
  const userId = req.user?.id;

  if (!userId || !credentialId) {
    return res.status(400).json({
      error: 'credentialId is required',
    });
  }

  const success = await storageManager.unlinkProvider(userId, credentialId);

  res.json({
    success,
    message: 'Provider unlinked successfully',
  });
});

const setDefaultProvider = asyncHandler(async (req, res) => {
  const { credentialId } = req.body;
  const userId = req.user?.id;

  if (!userId || !credentialId) {
    return res.status(400).json({
      error: 'credentialId is required',
    });
  }

  await storageManager.setDefaultProvider(userId, credentialId);

  res.json({
    success: true,
    message: 'Default provider set successfully',
  });
});

const getDefaultProvider = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.query.userId;

  if (!userId) {
    return res.status(400).json({
      error: 'userId is required',
    });
  }

  const provider = await storageManager.getDefaultProvider(userId);

  res.json(provider);
});

const listFiles = asyncHandler(async (req, res) => {
  const { provider, path = '/' } = req.query;
  const userId = req.user?.id;

  if (!userId || !provider) {
    return res.status(400).json({
      error: 'userId and provider are required',
    });
  }

  try {
    const storageProvider = await storageManager.getProvider(userId, provider);
    const files = await storageProvider.list(path);

    await storageManager.auditAction(userId, provider, 'list', path, '', 'success', null, {
      correlationId: req.headers['x-correlation-id'],
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      files,
      count: files.length,
      path,
      provider,
    });
  } catch (error) {
    await storageManager.auditAction(userId, provider, 'list', path, '', 'error', error, {
      correlationId: req.headers['x-correlation-id'],
    });

    throw error;
  }
});

const readFile = asyncHandler(async (req, res) => {
  const { provider, path } = req.query;
  const userId = req.user?.id;

  if (!userId || !provider || !path) {
    return res.status(400).json({
      error: 'userId, provider, and path are required',
    });
  }

  try {
    const storageProvider = await storageManager.getProvider(userId, provider);
    const content = await storageProvider.read(path);

    await storageManager.auditAction(
      userId,
      provider,
      'read',
      path,
      path.split('/').pop(),
      'success',
      null,
      {
        correlationId: req.headers['x-correlation-id'],
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch (error) {
    await storageManager.auditAction(
      userId,
      provider,
      'read',
      path,
      path.split('/').pop(),
      'error',
      error,
      {
        correlationId: req.headers['x-correlation-id'],
      }
    );

    throw error;
  }
});

const writeFile = asyncHandler(async (req, res) => {
  const { provider, path, content } = req.body;
  const userId = req.user?.id;

  if (!userId || !provider || !path || content === undefined) {
    return res.status(400).json({
      error: 'userId, provider, path, and content are required',
    });
  }

  try {
    const storageProvider = await storageManager.getProvider(userId, provider);
    const result = await storageProvider.write(path, content);

    await storageManager.auditAction(
      userId,
      provider,
      'write',
      path,
      path.split('/').pop(),
      'success',
      null,
      {
        correlationId: req.headers['x-correlation-id'],
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.status(201).json(result);
  } catch (error) {
    await storageManager.auditAction(
      userId,
      provider,
      'write',
      path,
      path.split('/').pop(),
      'error',
      error,
      {
        correlationId: req.headers['x-correlation-id'],
      }
    );

    throw error;
  }
});

const renameFile = asyncHandler(async (req, res) => {
  const { provider, oldPath, newPath } = req.body;
  const userId = req.user?.id;

  if (!userId || !provider || !oldPath || !newPath) {
    return res.status(400).json({
      error: 'userId, provider, oldPath, and newPath are required',
    });
  }

  try {
    const storageProvider = await storageManager.getProvider(userId, provider);
    const result = await storageProvider.rename(oldPath, newPath);

    await storageManager.auditAction(
      userId,
      provider,
      'rename',
      oldPath,
      oldPath.split('/').pop(),
      'success',
      null,
      {
        correlationId: req.headers['x-correlation-id'],
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        newPath,
      }
    );

    res.json(result);
  } catch (error) {
    await storageManager.auditAction(
      userId,
      provider,
      'rename',
      oldPath,
      oldPath.split('/').pop(),
      'error',
      error,
      {
        correlationId: req.headers['x-correlation-id'],
      }
    );

    throw error;
  }
});

const deleteFile = asyncHandler(async (req, res) => {
  const { provider, path } = req.body;
  const userId = req.user?.id;

  if (!userId || !provider || !path) {
    return res.status(400).json({
      error: 'userId, provider, and path are required',
    });
  }

  try {
    const storageProvider = await storageManager.getProvider(userId, provider);
    const success = await storageProvider.delete(path);

    await storageManager.auditAction(
      userId,
      provider,
      'delete',
      path,
      path.split('/').pop(),
      'success',
      null,
      {
        correlationId: req.headers['x-correlation-id'],
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json({ success });
  } catch (error) {
    await storageManager.auditAction(
      userId,
      provider,
      'delete',
      path,
      path.split('/').pop(),
      'error',
      error,
      {
        correlationId: req.headers['x-correlation-id'],
      }
    );

    throw error;
  }
});

const searchFiles = asyncHandler(async (req, res) => {
  const { provider, query, maxResults = 100 } = req.query;
  const userId = req.user?.id;

  if (!userId || !provider || !query) {
    return res.status(400).json({
      error: 'userId, provider, and query are required',
    });
  }

  try {
    const storageProvider = await storageManager.getProvider(userId, provider);
    const results = await storageProvider.search(query, { maxResults: parseInt(maxResults) });

    await storageManager.auditAction(userId, provider, 'search', '', '', 'success', null, {
      correlationId: req.headers['x-correlation-id'],
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      query,
    });

    res.json({
      results,
      count: results.length,
      query,
      provider,
    });
  } catch (error) {
    await storageManager.auditAction(userId, provider, 'search', '', '', 'error', error, {
      correlationId: req.headers['x-correlation-id'],
    });

    throw error;
  }
});

const getFileMetadata = asyncHandler(async (req, res) => {
  const { provider, path } = req.query;
  const userId = req.user?.id;

  if (!userId || !provider || !path) {
    return res.status(400).json({
      error: 'userId, provider, and path are required',
    });
  }

  try {
    const storageProvider = await storageManager.getProvider(userId, provider);
    const metadata = await storageProvider.metadata(path);

    await storageManager.auditAction(
      userId,
      provider,
      'metadata',
      path,
      path.split('/').pop(),
      'success',
      null,
      {
        correlationId: req.headers['x-correlation-id'],
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }
    );

    res.json(metadata);
  } catch (error) {
    await storageManager.auditAction(
      userId,
      provider,
      'metadata',
      path,
      path.split('/').pop(),
      'error',
      error,
      {
        correlationId: req.headers['x-correlation-id'],
      }
    );

    throw error;
  }
});

const getAuditLogs = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.query.userId;

  if (!userId) {
    return res.status(400).json({
      error: 'userId is required',
    });
  }

  const { provider, action, startDate, endDate, limit, offset } = req.query;

  const logs = await storageManager.getAuditLogs(userId, {
    provider,
    action,
    startDate,
    endDate,
    limit: parseInt(limit) || 100,
    offset: parseInt(offset) || 0,
  });

  res.json(logs);
});

module.exports = {
  listProviders,
  getUserProviders,
  linkProvider,
  unlinkProvider,
  setDefaultProvider,
  getDefaultProvider,
  listFiles,
  readFile,
  writeFile,
  renameFile,
  deleteFile,
  searchFiles,
  getFileMetadata,
  getAuditLogs,
};
