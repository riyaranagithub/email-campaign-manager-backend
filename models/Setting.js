import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global',
    },
    smtpHost: {
      type: String,
      default: 'smtp.gmail.com',
    },
    smtpPort: {
      type: Number,
      default: 587,
    },
    smtpSecure: {
      type: Boolean,
      default: false,
    },
    smtpUser: {
      type: String,
      default: '',
    },
    smtpPass: {
      type: String,
      default: '',
    },
    senderName: {
      type: String,
      default: 'EmailPro Campaign Manager',
    },
    senderEmail: {
      type: String,
      default: '',
    },
    geminiApiKey: {
      type: String,
      default: '',
    },
    testMode: {
      type: Boolean,
      default: true, // True = simulate/ethereal delivery if SMTP is unconfigured
    },
  },
  { timestamps: true }
);

export const Setting = mongoose.model('Setting', settingSchema);
