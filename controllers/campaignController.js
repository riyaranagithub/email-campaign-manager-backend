import { Campaign } from '../models/Campaign.js';
import { Email } from '../models/Email.js';
import { dispatchCampaign } from '../services/emailService.js';

/**
 * Create a new campaign
 */
export const createCampaign = async (req, res) => {
  try {
    const { title, subject, content, targetAudience = 'all', senderName, senderEmail } = req.body;

    if (!subject || !content) {
      return res.status(400).json({ success: false, message: 'Subject and content are required' });
    }

    // Determine target recipient count
    const filter = { status: 'active' };
    if (targetAudience !== 'all') {
      filter.category = targetAudience;
    }
    const count = await Email.countDocuments(filter);

    const campaign = await Campaign.create({
      title: title || subject,
      subject,
      content,
      targetAudience,
      totalRecipients: count,
      senderName,
      senderEmail,
      hasAttachment: !!req.file,
      attachmentName: req.file ? req.file.originalname : '',
    });

    return res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Send an existing campaign or create & dispatch simultaneously
 */
export const sendCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    let campaign = await Campaign.findById(id);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    // Fetch target recipients
    const filter = { status: 'active' };
    if (campaign.targetAudience !== 'all') {
      filter.category = campaign.targetAudience;
    }

    const recipients = await Email.find(filter).lean();

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No recipients found for audience "${campaign.targetAudience}". Please add or classify emails first.`,
      });
    }

    // Dispatch emails in background / async
    const result = await dispatchCampaign(campaign._id, recipients, req.file);

    return res.json({
      success: true,
      message: `Campaign dispatch finished. Delivered: ${result.sent}, Failed: ${result.failed}`,
      data: result,
    });
  } catch (error) {
    console.error('Error dispatching campaign:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send campaign',
      error: error.message,
    });
  }
};

/**
 * Create and immediately launch a campaign (from single form submission with attachment)
 */
export const launchCampaignDirect = async (req, res) => {
  try {
    const { subject, content, targetAudience = 'all', title, senderName, senderEmail } = req.body;

    if (!subject || !content) {
      return res.status(400).json({ success: false, message: 'Subject and content are required' });
    }

    // Fetch target recipients
    const filter = { status: 'active' };
    if (targetAudience !== 'all') {
      filter.category = targetAudience;
    }

    const recipients = await Email.find(filter).lean();

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No recipients found for audience "${targetAudience}". Please add or classify emails first.`,
      });
    }

    const campaign = await Campaign.create({
      title: title || subject,
      subject,
      content,
      targetAudience,
      totalRecipients: recipients.length,
      senderName: senderName || 'EmailPro',
      senderEmail: senderEmail || '',
      hasAttachment: !!req.file,
      attachmentName: req.file ? req.file.originalname : '',
    });

    const result = await dispatchCampaign(campaign._id, recipients, req.file);

    return res.status(201).json({
      success: true,
      message: `Campaign launched successfully! ${result.sent} delivered, ${result.failed} failed.`,
      data: {
        campaignId: campaign._id,
        ...result,
      },
    });
  } catch (error) {
    console.error('Error in launchCampaignDirect:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to launch campaign',
      error: error.message,
    });
  }
};

/**
 * Get all campaigns
 */
export const getAllCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: campaigns });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get campaign by ID
 */
export const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id).lean();
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    return res.json({ success: true, data: campaign });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete campaign
 */
export const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    await Campaign.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
