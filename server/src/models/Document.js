const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    content: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      default: 'javascript',
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    collaborators: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        permission: {
          type: String,
          enum: ['read', 'write', 'admin'],
          default: 'read',
        },
      },
    ],
    version: {
      type: Number,
      default: 1,
    },
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    metadata: {
      fileSize: {
        type: Number,
        default: 0,
      },
      lineCount: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

documentSchema.index({ owner: 1, createdAt: -1 });
documentSchema.index({ room: 1 });
documentSchema.index({ isPublic: 1 });
documentSchema.index({ 'collaborators.user': 1 });

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;
