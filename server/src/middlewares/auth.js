const { AppError } = require('./errorHandler');
const asyncHandler = require('../utils/asyncHandler');

const authenticate = asyncHandler(async (_req, _res, _next) => {
  throw new AppError('Authentication not yet implemented', 501);
});

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
  authorize,
};
