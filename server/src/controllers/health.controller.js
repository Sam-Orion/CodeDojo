const mongoose = require('mongoose');
const config = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');

const getHealth = asyncHandler(async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV,
    version: '1.0.0',
    services: {
      database: 'healthy',
      websocket: 'healthy',
    },
  };

  if (mongoose.connection.readyState !== 1) {
    health.status = 'degraded';
    health.services.database = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

const getMetrics = asyncHandler(async (req, res) => {
  const { register } = require('../utils/metrics');
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

module.exports = {
  getHealth,
  getMetrics,
};
