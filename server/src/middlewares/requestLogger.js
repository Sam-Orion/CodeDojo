const logger = require('../utils/logger');
const { getCorrelationId } = require('../utils/correlationId');

const requestLogger = (req, res, next) => {
  const start = Date.now();
  const correlationId = getCorrelationId();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      correlationId,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    if (res.statusCode >= 500) {
      logger.error('Request failed', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Client error', logData);
    } else {
      logger.http('Request completed', logData);
    }
  });

  next();
};

module.exports = requestLogger;
