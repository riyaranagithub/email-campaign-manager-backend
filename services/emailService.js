import nodemailer from 'nodemailer';
import { Setting } from '../models/Setting.js';
import { Campaign } from '../models/Campaign.js';
import { EmailLog } from '../models/EmailLog.js';

let testAccount = null;

/**
 * Creates and returns a Nodemailer transporter
 */
export const getTransporter = async () => {
  let setting = null;
  try {
    setting = await Setting.findOne({ key: 'global' });
  } catch (e) {
    console.warn('Could not load settings:', e.message);
  }

  const host = setting?.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(setting?.smtpPort || process.env.SMTP_PORT || 587);
  const secure = setting?.smtpSecure ?? (process.env.SMTP_SECURE === 'true');
  const user = setting?.smtpUser || process.env.SMTP_USER || '';
  const pass = setting?.smtpPass || process.env.SMTP_PASS || '';

  // If real SMTP credentials are provided, use them
  if (user && pass) {
    return {
      transporter: nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      }),
      isTest: false,
      senderEmail: setting?.senderEmail || process.env.SENDER_EMAIL || user,
      senderName: setting?.senderName || process.env.SENDER_NAME || 'EmailPro',
    };
  }

  // Fallback: Use Ethereal test SMTP account for realistic development testing
  if (!testAccount) {
    try {
      testAccount = await nodemailer.createTestAccount();
      console.log('📬 Ethereal test email account created:', testAccount.user);
    } catch (err) {
      console.warn('⚠️ Could not generate Ethereal account, falling back to simulated transport.');
    }
  }

  if (testAccount) {
    return {
      transporter: nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      }),
      isTest: true,
      senderEmail: testAccount.user,
      senderName: setting?.senderName || process.env.SENDER_NAME || 'EmailPro Campaign Manager',
    };
  }

  // Pure simulation mock transporter if network is restricted
  return {
    transporter: {
      sendMail: async (mailOptions) => {
        // simulate 50ms latency
        await new Promise((r) => setTimeout(r, 50));
        return {
          messageId: `simulated-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          response: '250 OK: Simulated delivery',
        };
      },
      verify: async () => true,
    },
    isTest: true,
    senderEmail: 'test@emailpro.local',
    senderName: 'EmailPro Simulator',
  };
};

/**
 * Replace placeholders in template
 */
export const compileTemplate = (template, contact) => {
  if (!template) return '';
  const name = contact.name && contact.name.trim() ? contact.name.trim() : 'there';
  const email = contact.email || '';
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return template
    .replace(/\{name\}/gi, name)
    .replace(/\{email\}/gi, email)
    .replace(/\{date\}/gi, date);
};

/**
 * Send campaign to a list of contacts
 * @param {string} campaignId
 * @param {Array<{email: string, name: string, category: string}>} recipients
 * @param {object} [attachment]
 */
export const dispatchCampaign = async (campaignId, recipients, attachment = null) => {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  campaign.status = 'in_progress';
  campaign.startedAt = new Date();
  campaign.totalRecipients = recipients.length;
  campaign.sent = 0;
  campaign.failed = 0;
  await campaign.save();

  const { transporter, isTest, senderEmail, senderName } = await getTransporter();
  const fromAddress = `"${senderName}" <${senderEmail}>`;

  let sentCount = 0;
  let failedCount = 0;

  for (const contact of recipients) {
    const personalizedSubject = compileTemplate(campaign.subject, contact);
    const personalizedBody = compileTemplate(campaign.content, contact);

    // Convert newlines to HTML paragraphs/breaks if plain text
    const htmlBody = personalizedBody.includes('<') && personalizedBody.includes('>')
      ? personalizedBody
      : personalizedBody.replace(/\n/g, '<br/>');

    const mailOptions = {
      from: fromAddress,
      to: contact.email,
      subject: personalizedSubject,
      text: personalizedBody,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${htmlBody}
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0 15px;" />
          <p style="font-size: 11px; color: #888;">
            Sent by ${senderName} | You are receiving this email as part of a campaign.
          </p>
        </div>
      `,
    };

    if (attachment && attachment.path) {
      mailOptions.attachments = [
        {
          filename: attachment.originalname || attachment.filename,
          path: attachment.path,
        },
      ];
    }

    try {
      const info = await transporter.sendMail(mailOptions);
      sentCount++;

      const previewUrl = isTest && typeof nodemailer.getTestMessageUrl === 'function'
        ? nodemailer.getTestMessageUrl(info)
        : null;

      await EmailLog.create({
        campaignId: campaign._id,
        email: contact.email,
        name: contact.name || '',
        category: contact.category || 'unclassified',
        status: 'delivered',
        response: previewUrl ? `Delivered (Ethereal Preview: ${previewUrl})` : info.messageId || 'Delivered',
        errorMessage: '',
      });
    } catch (error) {
      failedCount++;
      console.error(`❌ Failed to send email to ${contact.email}:`, error.message);

      await EmailLog.create({
        campaignId: campaign._id,
        email: contact.email,
        name: contact.name || '',
        category: contact.category || 'unclassified',
        status: 'failed',
        errorMessage: error.message || 'SMTP delivery failure',
      });
    }

    // Update campaign counters incrementally
    campaign.sent = sentCount;
    campaign.failed = failedCount;
    await campaign.save();
  }

  campaign.status = 'completed';
  campaign.completedAt = new Date();
  await campaign.save();

  return {
    campaignId: campaign._id,
    total: recipients.length,
    sent: sentCount,
    failed: failedCount,
  };
};
