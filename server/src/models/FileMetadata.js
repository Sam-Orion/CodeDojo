const mongoose = require('mongoose');

const fileMetadataSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    path: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    storageProvider: {
      type: String,
      enum: ['local', 's3', 'azure', 'gcs'],
      default: 'local',
    },
    storageKey: {
      type: String,
      default: null,
    },
    checksum: {
      type: String,
      default: null,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    metadata: {
      encoding: {
        type: String,
        default: null,
      },
      width: {
        type: Number,
        default: null,
      },
      height: {
        type: Number,
        default: null,
      },
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

fileMetadataSchema.index({ owner: 1, createdAt: -1 });
fileMetadataSchema.index({ document: 1 });
fileMetadataSchema.index({ room: 1 });
fileMetadataSchema.index({ expiresAt: 1 }, { sparse: true });
fileMetadataSchema.index({ storageProvider: 1, storageKey: 1 });

const FileMetadata = mongoose.model('FileMetadata', fileMetadataSchema);

module.exports = FileMetadata;
