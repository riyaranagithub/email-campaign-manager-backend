import { Email } from '../models/Email.js';
import { parseAndDeduplicateCSV } from '../services/csvService.js';

/**
 * Handle CSV upload, parsing, deduplication, and database insertion
 */
export const uploadEmails = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a CSV file' });
    }

    const { records, stats } = await parseAndDeduplicateCSV(req.file.path);

    if (records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid email addresses found in the uploaded CSV',
        stats,
      });
    }

    // Get all existing emails from DB to avoid inserting existing duplicates
    const existingEmails = await Email.find({}, { email: 1 }).lean();
    const existingSet = new Set(existingEmails.map((e) => e.email.toLowerCase()));

    const newRecords = [];
    let alreadyInDbCount = 0;

    for (const rec of records) {
      if (existingSet.has(rec.email)) {
        alreadyInDbCount++;
      } else {
        newRecords.push(rec);
        existingSet.add(rec.email); // avoid duplicates within newRecords
      }
    }

    let insertedCount = 0;
    if (newRecords.length > 0) {
      const inserted = await Email.insertMany(newRecords, { ordered: false });
      insertedCount = inserted.length;
    }

    const totalDatabaseEmails = await Email.countDocuments();

    return res.status(200).json({
      success: true,
      message: `Successfully processed ${stats.totalRows} rows. Added ${insertedCount} new emails.`,
      stats: {
        totalRowsInFile: stats.totalRows,
        validInFile: stats.validRows,
        fileDuplicates: stats.duplicateRows,
        alreadyInDatabase: alreadyInDbCount,
        newlyInserted: insertedCount,
        invalidRows: stats.invalidRows,
        totalInDatabase: totalDatabaseEmails,
      },
    });
  } catch (error) {
    console.error('Error uploading CSV:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process CSV file',
      error: error.message,
    });
  }
};

/**
 * Get all emails with optional category, search, and pagination
 */
export const getEmails = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Email.countDocuments(filter);
    const emails = await Email.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.json({
      success: true,
      data: emails,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get statistics summary
 */
export const getEmailStats = async (req, res) => {
  try {
    const [total, business, individual, unclassified] = await Promise.all([
      Email.countDocuments(),
      Email.countDocuments({ category: 'business' }),
      Email.countDocuments({ category: 'individual' }),
      Email.countDocuments({ category: 'unclassified' }),
    ]);

    return res.json({
      success: true,
      stats: {
        total,
        business,
        individual,
        unclassified,
        classified: business + individual,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Manually trigger deduplication across the entire database
 */
export const removeDuplicates = async (req, res) => {
  try {
    // Find all duplicate emails
    const duplicates = await Email.aggregate([
      {
        $group: {
          _id: { email: '$email' },
          ids: { $push: '$_id' },
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
    ]);

    let removedCount = 0;
    for (const dup of duplicates) {
      // Keep the first, delete the rest
      const [keepId, ...deleteIds] = dup.ids;
      if (deleteIds.length > 0) {
        const deleted = await Email.deleteMany({ _id: { $in: deleteIds } });
        removedCount += deleted.deletedCount;
      }
    }

    return res.json({
      success: true,
      message: `Cleaned ${removedCount} duplicate records from the database.`,
      removedCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Add single email manually
 */
export const addEmail = async (req, res) => {
  try {
    const { email, name, category = 'unclassified' } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const normalized = email.trim().toLowerCase();
    const existing = await Email.findOne({ email: normalized });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email already exists in database' });
    }

    const newEmail = await Email.create({
      email: normalized,
      name: name || '',
      category,
    });

    return res.status(201).json({ success: true, data: newEmail });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Delete single email
 */
export const deleteEmail = async (req, res) => {
  try {
    const { id } = req.params;
    await Email.findByIdAndDelete(id);
    return res.json({ success: true, message: 'Email deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Clear all emails
 */
export const clearEmails = async (req, res) => {
  try {
    await Email.deleteMany({});
    return res.json({ success: true, message: 'All emails cleared from database' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
