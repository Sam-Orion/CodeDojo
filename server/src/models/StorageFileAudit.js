const mongoose = require('mongoose');

const storageFileAuditSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ['local', 'google-drive', 'onedrive'],
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['read', 'write', 'rename', 'delete', 'search', 'list', 'metadata'],
      index: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    mimeType: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['success', 'error', 'pending'],
      default: 'success',
      index: true,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    metadata: {
      ipAddress: String,
      userAgent: String,
      correlationId: String,
      [String]: mongoose.Schema.Types.Mixed,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// Indexes for efficient querying
storageFileAuditSchema.index({ userId: 1, createdAt: -1 });
storageFileAuditSchema.index({ provider: 1, createdAt: -1 });
storageFileAuditSchema.index({ userId: 1, action: 1, createdAt: -1 });
storageFileAuditSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL

module.exports = mongoose.model('StorageFileAudit', storageFileAuditSchema);
