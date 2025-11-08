const { AppError } = require('./errorHandler');
const asyncHandler = require('../utils/asyncHandler');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

const authenticate = asyncHandler(async (req, res, next) => {
  // For development, allow requests with userId in body or headers
  if (config.NODE_ENV === 'development') {
    const userId = req.body.userId || req.headers['x-user-id'] || 'dev-user';
    req.user = { id: userId };
    return next();
  }

  // Production JWT authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Access token required', 401);
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    throw new AppError('Invalid or expired token', 401);
  }
});

// Alias for backward compatibility
const authenticateToken = authenticate;

const authorize = (...roles) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    if (!roles.includes(req.user.role)) {
      throw new AppError('Not authorized to access this resource', 403);
    }

    next();
  });
};

module.exports = {
  authenticate,
  authenticateToken,
  authorize,
};
