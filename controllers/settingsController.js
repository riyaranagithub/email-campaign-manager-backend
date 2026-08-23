import nodemailer from 'nodemailer';
import { Setting } from '../models/Setting.js';

/**
 * Get current settings
 */
export const getSettings = async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: 'global' });
    if (!setting) {
      setting = await Setting.create({
        key: 'global',
        smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
        smtpPort: Number(process.env.SMTP_PORT) || 587,
        smtpSecure: process.env.SMTP_SECURE === 'true',
        smtpUser: process.env.SMTP_USER || '',
        senderName: process.env.SENDER_NAME || 'EmailPro Campaign Manager',
        senderEmail: process.env.SENDER_EMAIL || '',
      });
    }

    return res.json({
      success: true,
      data: {
        smtpHost: setting.smtpHost,
        smtpPort: setting.smtpPort,
        smtpSecure: setting.smtpSecure,
        smtpUser: setting.smtpUser,
        hasSmtpPass: !!(setting.smtpPass || process.env.SMTP_PASS),
        senderName: setting.senderName,
        senderEmail: setting.senderEmail,
        hasGeminiKey: !!(setting.geminiApiKey || process.env.GEMINI_API_KEY),
        testMode: setting.testMode,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update settings
 */
export const updateSettings = async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, senderName, senderEmail, geminiApiKey, testMode } = req.body;

    const updateData = {
      smtpHost,
      smtpPort: Number(smtpPort) || 587,
      smtpSecure: !!smtpSecure,
      smtpUser,
      senderName,
      senderEmail,
      testMode: testMode !== undefined ? testMode : true,
    };

    if (smtpPass && smtpPass.trim() !== '') {
      updateData.smtpPass = smtpPass;
    }

    if (geminiApiKey && geminiApiKey.trim() !== '') {
      updateData.geminiApiKey = geminiApiKey;
    }

    const updated = await Setting.findOneAndUpdate(
      { key: 'global' },
      { $set: updateData },
      { new: true, upsert: true }
    );

    return res.json({
      success: true,
      message: 'Settings updated successfully',
      data: {
        smtpHost: updated.smtpHost,
        smtpPort: updated.smtpPort,
        smtpSecure: updated.smtpSecure,
        smtpUser: updated.smtpUser,
        hasSmtpPass: !!updated.smtpPass,
        senderName: updated.senderName,
        senderEmail: updated.senderEmail,
        hasGeminiKey: !!updated.geminiApiKey,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Test SMTP connection
 */
export const testSMTP = async (req, res) => {
  try {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass } = req.body;

    let host = smtpHost;
    let port = Number(smtpPort) || 587;
    let secure = !!smtpSecure;
    let user = smtpUser;
    let pass = smtpPass;

    if (!user || !pass) {
      const setting = await Setting.findOne({ key: 'global' });
      user = user || setting?.smtpUser || process.env.SMTP_USER;
      pass = pass || setting?.smtpPass || process.env.SMTP_PASS;
      host = host || setting?.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
      port = port || Number(setting?.smtpPort || process.env.SMTP_PORT || 587);
    }

    if (!user || !pass) {
      return res.status(400).json({
        success: false,
        message: 'SMTP Username and Password are required to test connection.',
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });

    await transporter.verify();

    return res.json({
      success: true,
      message: 'SMTP connection verified successfully!',
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: `SMTP Connection Failed: ${error.message}`,
    });
  }
};
