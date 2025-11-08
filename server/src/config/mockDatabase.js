const { MongoMemoryServer } = require('mongodb-memory-server');
const logger = require('../utils/logger');

let mongoServer;

const startMockDatabase = async () => {
  try {
    logger.info('Starting in-memory MongoDB server...');
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    logger.info(`In-memory MongoDB started at: ${uri}`);
    return uri;
  } catch (error) {
    logger.error('Failed to start in-memory MongoDB:', error);
    throw error;
  }
};

const stopMockDatabase = async () => {
  if (mongoServer) {
    await mongoServer.stop();
    logger.info('In-memory MongoDB stopped');
  }
};

module.exports = {
  startMockDatabase,
  stopMockDatabase,
};
