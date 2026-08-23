import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      default: '',
    },
    category: {
      type: String,
      default: 'unclassified',
    },
    status: {
      type: String,
      enum: ['delivered', 'failed'],
      required: true,
      index: true,
    },
    response: {
      type: String,
      default: '',
    },
    errorMessage: {
      type: String,
      default: '',
    },
    sentAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const EmailLog = mongoose.model('EmailLog', emailLogSchema);
