const http = require('http');
const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const { connectDatabase, disconnectDatabase } = require('./config/database');
const websocketService = require('./services/websocket.service');

const server = http.createServer(app);

websocketService.initialize(server);

let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`${signal} received, starting graceful shutdown...`);

  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      websocketService.shutdown();
      await disconnectDatabase();
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forceful shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

const startServer = async () => {
  try {
    logger.info('Starting CodeDojo Server...');
    logger.info(`Environment: ${config.NODE_ENV}`);

    try {
      await connectDatabase();
    } catch (dbError) {
      logger.warn('Failed to connect to MongoDB, attempting to use in-memory database...');
      try {
        const { startMockDatabase } = require('./config/mockDatabase');
        const mockUri = await startMockDatabase();
        const mongoose = require('mongoose');
        await mongoose.connect(mockUri, {
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });
        logger.info('✅ Using in-memory MongoDB for development');
      } catch (mockError) {
        logger.error('Failed to start mock database:', mockError);
        throw dbError;
      }
    }

    server.listen(config.PORT, () => {
      logger.info(`🚀 Server running on http://localhost:${config.PORT}`);
      logger.info(`📊 Health check: http://localhost:${config.PORT}/api/v1/health`);
      logger.info(`📈 Metrics: http://localhost:${config.PORT}/api/v1/health/metrics`);
      logger.info(`🔌 WebSocket server ready`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = server;
