import mongoose from 'mongoose';

const emailSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      enum: ['business', 'individual', 'unclassified'],
      default: 'unclassified',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'unsubscribed', 'bounced'],
      default: 'active',
      index: true,
    },
    source: {
      type: String,
      default: 'csv_upload',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    lastSentAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const Email = mongoose.model('Email', emailSchema);
