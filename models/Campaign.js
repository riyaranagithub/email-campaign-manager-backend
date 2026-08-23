import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      default: function () {
        return this.subject || 'Untitled Campaign';
      },
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    targetAudience: {
      type: String,
      enum: ['all', 'individual', 'business'],
      default: 'all',
      index: true,
    },
    totalRecipients: {
      type: Number,
      default: 0,
    },
    sent: {
      type: Number,
      default: 0,
    },
    failed: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft', 'in_progress', 'completed', 'failed'],
      default: 'draft',
      index: true,
    },
    senderName: {
      type: String,
      default: 'EmailPro',
    },
    senderEmail: {
      type: String,
      default: '',
    },
    hasAttachment: {
      type: Boolean,
      default: false,
    },
    attachmentName: {
      type: String,
      default: '',
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const Campaign = mongoose.model('Campaign', campaignSchema);
