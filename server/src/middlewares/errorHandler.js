const logger = require('../utils/logger');
const { getCorrelationId } = require('../utils/correlationId');
const config = require('../config/env');

class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, _next) => {
  const correlationId = getCorrelationId();

  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  const errorResponse = {
    status: err.status,
    message: err.message,
    correlationId,
  };

  if (config.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
    errorResponse.error = err;
  }

  logger.error('Error occurred', {
    correlationId,
    message: err.message,
    statusCode: err.statusCode,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });

  if (err.name === 'ValidationError') {
    errorResponse.statusCode = 400;
    errorResponse.message = 'Validation error';
    errorResponse.errors = Object.values(err.errors).map((e) => e.message);
  } else if (err.name === 'CastError') {
    errorResponse.statusCode = 400;
    errorResponse.message = 'Invalid ID format';
  } else if (err.code === 11000) {
    errorResponse.statusCode = 409;
    errorResponse.message = 'Duplicate field value';
  } else if (err.name === 'JsonWebTokenError') {
    errorResponse.statusCode = 401;
    errorResponse.message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    errorResponse.statusCode = 401;
    errorResponse.message = 'Token expired';
  }

  res.status(errorResponse.statusCode || err.statusCode).json(errorResponse);
};

const notFoundHandler = (req, res, _next) => {
  const correlationId = getCorrelationId();
  res.status(404).json({
    status: 'fail',
    message: `Route ${req.originalUrl} not found`,
    correlationId,
  });
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
};
