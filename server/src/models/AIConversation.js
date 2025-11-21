const mongoose = require('mongoose');

const aiMessageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'error', 'warning', 'info'],
      default: 'success',
    },
    isStreaming: {
      type: Boolean,
      default: false,
    },
    model: {
      type: String,
      default: null,
    },
    tokenCount: {
      type: Number,
      default: 0,
    },
    feedback: {
      type: {
        helpful: Boolean,
        rating: Number,
        comment: String,
      },
      default: null,
    },
    suggestions: {
      type: [String],
      default: null,
    },
    errorDetails: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const aiConversationSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: null,
    },
    messages: {
      type: [aiMessageSchema],
      default: [],
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active',
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: String,
      default: null,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
aiConversationSchema.index({ userId: 1, createdAt: -1 });
aiConversationSchema.index({ userId: 1, isFavorite: 1 });
aiConversationSchema.index({ userId: 1, updatedAt: -1 });
aiConversationSchema.index({ userId: 1, status: 1 });

/**
 * Static method to find conversation by ID and user
 */
aiConversationSchema.statics.findByUserAndId = async function (userId, conversationId) {
  return this.findOne({ userId, conversationId });
};

/**
 * Static method to find all conversations for a user
 */
aiConversationSchema.statics.findByUser = async function (userId, options = {}) {
  const { limit = 50, skip = 0, sortBy = 'updatedAt', sortOrder = -1, status } = options;
  const query = { userId };

  if (status && status !== 'all') {
    if (Array.isArray(status)) {
      query.status = { $in: status };
    } else {
      query.status = status;
    }
  }

  return this.find(query)
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit);
};

/**
 * Instance method to add a message
 */
aiConversationSchema.methods.addMessage = function (message) {
  this.messages.push({
    messageId: message.id,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp || Date.now(),
    status: message.status || 'success',
    isStreaming: Boolean(message.isStreaming),
    model: message.model || null,
    tokenCount: message.tokenCount || 0,
    feedback: message.feedback || null,
    suggestions: message.suggestions || null,
    errorDetails: message.errorDetails || null,
  });
  this.updatedAt = new Date();
};

/**
 * Instance method to update message
 */
aiConversationSchema.methods.updateMessage = function (messageId, updates) {
  const message = this.messages.find((m) => m.messageId === messageId);
  if (message) {
    Object.assign(message, updates);
    this.updatedAt = new Date();
    return true;
  }
  return false;
};

/**
 * Instance method to delete a message
 */
aiConversationSchema.methods.deleteMessage = function (messageId) {
  const index = this.messages.findIndex((m) => m.messageId === messageId);
  if (index !== -1) {
    this.messages.splice(index, 1);
    this.updatedAt = new Date();
    return true;
  }
  return false;
};

/**
 * Transform to JSON format matching frontend types
 */
aiConversationSchema.methods.toJSON = function () {
  return {
    id: this.conversationId,
    title: this.title,
    messages: this.messages.map((msg) => ({
      id: msg.messageId,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      status: msg.status,
      isStreaming: msg.isStreaming,
      model: msg.model,
      tokenCount: msg.tokenCount,
      feedback: msg.feedback,
      suggestions: msg.suggestions,
      errorDetails: msg.errorDetails,
    })),
    isFavorite: this.isFavorite,
    status: this.status,
    archivedAt: this.archivedAt ? this.archivedAt.toISOString() : null,
    deletedAt: this.deletedAt ? this.deletedAt.toISOString() : null,
    deletedBy: this.deletedBy,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
    metadata: this.metadata ? Object.fromEntries(this.metadata) : {},
  };
};

const AIConversation = mongoose.model('AIConversation', aiConversationSchema);

module.exports = AIConversation;
