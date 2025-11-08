const correlationId = require('./correlationId');
const requestLogger = require('./requestLogger');
const metrics = require('./metrics');
const { authenticate, authorize } = require('./auth');
const { errorHandler, notFoundHandler, AppError } = require('./errorHandler');

module.exports = {
  correlationId,
  requestLogger,
  metrics,
  authenticate,
  authorize,
  errorHandler,
  notFoundHandler,
  AppError,
};
