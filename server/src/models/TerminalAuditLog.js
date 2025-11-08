const mongoose = require('mongoose');

const terminalAuditLogSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    roomId: {
      type: String,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['CREATE', 'INPUT', 'OUTPUT', 'RESIZE', 'EXIT', 'ERROR', 'TERMINATE'],
    },
    language: {
      type: String,
      required: true,
    },
    mode: {
      type: String,
      required: true,
      enum: ['local', 'cloud', 'auto'],
    },
    executorType: {
      type: String,
      enum: ['pty', 'container', 'gcp', 'aws-lambda', 'aws-fargate', 'azure'],
    },
    data: {
      type: String,
      maxlength: 10000,
    },
    exitCode: {
      type: Number,
    },
    error: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

terminalAuditLogSchema.index({ createdAt: 1 });
terminalAuditLogSchema.index({ sessionId: 1, createdAt: 1 });
terminalAuditLogSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('TerminalAuditLog', terminalAuditLogSchema);
