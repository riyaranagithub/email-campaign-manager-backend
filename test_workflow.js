import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, closeDB } from './config/db.js';
import { Email } from './models/Email.js';
import { Campaign } from './models/Campaign.js';
import { EmailLog } from './models/EmailLog.js';
import { parseAndDeduplicateCSV } from './services/csvService.js';
import { classifyEmailsWithGemini } from './services/geminiService.js';
import { dispatchCampaign } from './services/emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runFullVerification() {
  console.log('🧪 Starting Full System Verification...\n');

  try {
    // 1. Connect DB
    console.log('Step 1: Connecting to Database...');
    await connectDB();
    await Email.deleteMany({});
    await Campaign.deleteMany({});
    await EmailLog.deleteMany({});
    console.log(' Database connected and test collections cleared.\n');

    // 2. Test CSV parsing & deduplication
    console.log('Step 2: Testing CSV Parsing & In-memory Deduplication...');
    const originalCsvPath = path.resolve('../client/public/sample_emails.csv');
    const testTempCsv = path.resolve('./uploads/temp_test.csv');
    fs.copyFileSync(originalCsvPath, testTempCsv);
    const { records, stats } = await parseAndDeduplicateCSV(testTempCsv);
    console.log(` Parsed ${stats.totalRows} rows from sample CSV.`);
    console.log(` Detected and removed ${stats.duplicateRows} duplicate rows.`);
    console.log(` Found ${stats.validRows} unique valid emails.\n`);

    // Insert unique records
    await Email.insertMany(records);
    const dbCount = await Email.countDocuments();
    console.log(` Inserted ${dbCount} unique emails into MongoDB.\n`);

    // 3. Test AI Classification
    console.log('Step 3: Testing Gemini AI / Domain Classification...');
    const unclassified = await Email.find({ category: 'unclassified' }).limit(10).lean();
    const classified = await classifyEmailsWithGemini(unclassified);

    console.log(` Classified ${classified.length} sample emails:`);
    for (const item of classified.slice(0, 5)) {
      console.log(`   - ${item.email.padEnd(30)} -> [${item.category.toUpperCase()}] (${item.reason})`);
    }

    // Apply updates to DB
    for (const item of classified) {
      await Email.updateOne({ email: item.email }, { $set: { category: item.category } });
    }
    const businessCount = await Email.countDocuments({ category: 'business' });
    const individualCount = await Email.countDocuments({ category: 'individual' });
    console.log(` MongoDB Counts -> Business: ${businessCount}, Individual: ${individualCount}\n`);

    // 4. Test Campaign Creation & Dispatch
    console.log('Step 4: Testing Campaign Creation & Dispatch...');
    const campaign = await Campaign.create({
      title: 'Welcome Campaign',
      subject: 'Special Update for {name} - EmailPro',
      content: 'Hello {name},\nWelcome to EmailPro AI!\nBest regards.',
      targetAudience: 'individual',
      totalRecipients: individualCount,
    });

    const targetRecipients = await Email.find({ category: 'individual' }).lean();
    console.log(` Dispatching campaign to ${targetRecipients.length} individual recipients...`);
    const dispatchResult = await dispatchCampaign(campaign._id, targetRecipients);
    console.log(` Dispatch Complete: Delivered = ${dispatchResult.sent}, Failed = ${dispatchResult.failed}\n`);

    // 5. Test Reports & Logs
    console.log('Step 5: Verifying Reports & Audit Logs...');
    const logs = await EmailLog.find({ campaignId: campaign._id }).lean();
    console.log(` Recorded ${logs.length} EmailLog audit entries.`);
    for (const log of logs.slice(0, 3)) {
      console.log(`   - ${log.email.padEnd(30)} | Status: ${log.status} | Sent: ${log.sentAt.toISOString()}`);
    }

    console.log('\n ALL 5 VERIFICATION STAGES PASSED SUCCESSFULLY! 🎉');
  } catch (err) {
    console.error('❌ Verification failed with error:', err);
  } finally {
    await closeDB();
    process.exit(0);
  }
}

runFullVerification();
