const { v4: uuidv4 } = require('uuid');

const asyncLocalStorage = require('./asyncLocalStorage');

const generateCorrelationId = () => {
  return uuidv4();
};

const getCorrelationId = () => {
  const store = asyncLocalStorage.getStore();
  return store?.correlationId;
};

const setCorrelationId = (correlationId) => {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.correlationId = correlationId;
  }
};

module.exports = {
  generateCorrelationId,
  getCorrelationId,
  setCorrelationId,
};
