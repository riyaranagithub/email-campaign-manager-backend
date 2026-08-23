import { Email } from '../models/Email.js';
import { classifyEmailsWithGemini } from '../services/geminiService.js';

/**
 * Run Gemini AI classification on unclassified (or all) emails
 */
export const runClassification = async (req, res) => {
  try {
    const { reclassifyAll = false, limit = 500 } = req.body;

    const query = reclassifyAll ? {} : { category: 'unclassified' };
    const emailsToClassify = await Email.find(query).limit(Number(limit)).lean();

    if (emailsToClassify.length === 0) {
      return res.json({
        success: true,
        message: 'No unclassified emails found to process.',
        classifiedCount: 0,
        stats: {
          business: await Email.countDocuments({ category: 'business' }),
          individual: await Email.countDocuments({ category: 'individual' }),
          unclassified: await Email.countDocuments({ category: 'unclassified' }),
        },
      });
    }

    // Process in batches of 50
    const BATCH_SIZE = 50;
    let totalUpdated = 0;
    let businessCount = 0;
    let individualCount = 0;

    for (let i = 0; i < emailsToClassify.length; i += BATCH_SIZE) {
      const batch = emailsToClassify.slice(i, i + BATCH_SIZE);
      const results = await classifyEmailsWithGemini(batch);

      // Bulk update DB
      const bulkOps = results.map((item) => {
        if (item.category === 'business') businessCount++;
        if (item.category === 'individual') individualCount++;

        return {
          updateOne: {
            filter: { email: item.email.toLowerCase() },
            update: {
              $set: {
                category: item.category,
              },
            },
          },
        };
      });

      if (bulkOps.length > 0) {
        await Email.bulkWrite(bulkOps);
        totalUpdated += bulkOps.length;
      }
    }

    const [totalBusiness, totalIndividual, totalUnclassified, total] = await Promise.all([
      Email.countDocuments({ category: 'business' }),
      Email.countDocuments({ category: 'individual' }),
      Email.countDocuments({ category: 'unclassified' }),
      Email.countDocuments(),
    ]);

    return res.json({
      success: true,
      message: `Successfully classified ${totalUpdated} emails with Gemini AI.`,
      classifiedInThisRun: totalUpdated,
      resultsInRun: {
        business: businessCount,
        individual: individualCount,
      },
      currentStats: {
        total,
        business: totalBusiness,
        individual: totalIndividual,
        unclassified: totalUnclassified,
        classified: totalBusiness + totalIndividual,
      },
    });
  } catch (error) {
    console.error('Error running AI classification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to run AI classification',
      error: error.message,
    });
  }
};

/**
 * Manually override/update category for a specific email
 */
export const updateEmailCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.body;

    if (!['business', 'individual', 'unclassified'].includes(category)) {
      return res.status(400).json({ success: false, message: 'Invalid category' });
    }

    const updated = await Email.findByIdAndUpdate(
      id,
      { category },
      { new: true }
    );

    return res.json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
