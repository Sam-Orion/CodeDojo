// Global test setup

// Ensure predictable environment variables for configuration validation
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-assistant-test';
process.env.AI_ENCRYPTION_KEY =
  process.env.AI_ENCRYPTION_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.STORAGE_ENCRYPTION_KEY =
  process.env.STORAGE_ENCRYPTION_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
