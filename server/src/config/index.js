const config = require('./env');
const { connectDatabase, disconnectDatabase } = require('./database');

module.exports = {
  config,
  connectDatabase,
  disconnectDatabase,
};
