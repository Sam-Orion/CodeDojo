const asyncHandler = require('../utils/asyncHandler');
const { AppError } = require('../middlewares/errorHandler');

const register = asyncHandler(async (_req, _res) => {
  throw new AppError('User registration not yet implemented', 501);
});

const login = asyncHandler(async (_req, _res) => {
  throw new AppError('User login not yet implemented', 501);
});

const logout = asyncHandler(async (_req, _res) => {
  throw new AppError('User logout not yet implemented', 501);
});

const getCurrentUser = asyncHandler(async (_req, _res) => {
  throw new AppError('Get current user not yet implemented', 501);
});

const refreshToken = asyncHandler(async (_req, _res) => {
  throw new AppError('Token refresh not yet implemented', 501);
});

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  refreshToken,
};
