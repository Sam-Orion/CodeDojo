const asyncLocalStorage = require('../utils/asyncLocalStorage');
const { generateCorrelationId } = require('../utils/correlationId');

const correlationIdMiddleware = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();

  res.setHeader('X-Correlation-ID', correlationId);

  asyncLocalStorage.run({ correlationId }, () => {
    next();
  });
};

module.exports = correlationIdMiddleware;
