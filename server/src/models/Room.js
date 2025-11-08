const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: {
          type: String,
          enum: ['owner', 'moderator', 'participant'],
          default: 'participant',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    activeConnections: {
      type: Number,
      default: 0,
    },
    maxParticipants: {
      type: Number,
      default: 50,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    settings: {
      allowAnonymous: {
        type: Boolean,
        default: false,
      },
      requireApproval: {
        type: Boolean,
        default: false,
      },
      enableChat: {
        type: Boolean,
        default: true,
      },
      enableTerminal: {
        type: Boolean,
        default: true,
      },
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

roomSchema.index({ slug: 1 });
roomSchema.index({ owner: 1 });
roomSchema.index({ isPublic: 1, isActive: 1 });
roomSchema.index({ lastActivityAt: -1 });
roomSchema.index({ 'participants.user': 1 });

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;
