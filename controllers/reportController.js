import { Campaign } from '../models/Campaign.js';
import { EmailLog } from '../models/EmailLog.js';

/**
 * Get overall delivery analytics summary
 */
export const getDeliverySummary = async (req, res) => {
  try {
    const totalCampaigns = await Campaign.countDocuments();
    const campaigns = await Campaign.find().sort({ createdAt: -1 }).limit(10).lean();

    const [totalLogs, deliveredLogs, failedLogs] = await Promise.all([
      EmailLog.countDocuments(),
      EmailLog.countDocuments({ status: 'delivered' }),
      EmailLog.countDocuments({ status: 'failed' }),
    ]);

    const deliveryRate = totalLogs > 0 ? ((deliveredLogs / totalLogs) * 100).toFixed(1) : '100.0';

    return res.json({
      success: true,
      data: {
        totalCampaigns,
        totalSent: totalLogs,
        delivered: deliveredLogs,
        failed: failedLogs,
        deliveryRate: Number(deliveryRate),
        recentCampaigns: campaigns,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get detailed report for a specific campaign
 */
export const getCampaignReport = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findById(id).lean();

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const logs = await EmailLog.find({ campaignId: id }).sort({ createdAt: -1 }).lean();

    const deliveredList = logs.filter((l) => l.status === 'delivered');
    const failedList = logs.filter((l) => l.status === 'failed');

    const total = logs.length;
    const rate = total > 0 ? ((deliveredList.length / total) * 100).toFixed(1) : 100;

    return res.json({
      success: true,
      data: {
        campaign,
        totalRecipients: total || campaign.totalRecipients,
        deliveredCount: deliveredList.length,
        failedCount: failedList.length,
        deliveryRate: Number(rate),
        delivered: deliveredList,
        failed: failedList,
        allLogs: logs,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Export logs as downloadable CSV string
 */
export const exportLogsCSV = async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await EmailLog.find({ campaignId: id }).lean();

    let csv = 'Email,Name,Category,Status,Response/Error,SentAt\n';
    for (const log of logs) {
      const sanitizedResp = (log.errorMessage || log.response || '').replace(/"/g, '""');
      csv += `"${log.email}","${log.name}","${log.category}","${log.status}","${sanitizedResp}","${new Date(log.sentAt).toISOString()}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${id}-logs.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
