import fs from 'fs';
import csvParser from 'csv-parser';

// RFC 5322 compliant email regex simplified
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Normalizes headers to identify 'email' and 'name'
 */
const findMatchingKey = (row, candidates) => {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const matched = keys.find(
      (k) => k.toLowerCase().replace(/[^a-z0-9]/g, '') === candidate.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    if (matched) return matched;
  }
  return null;
};

/**
 * Parses a CSV file and extracts valid unique email records
 * @param {string} filePath - Absolute path to the CSV file
 * @returns {Promise<{records: Array<{email: string, name: string}>, stats: object}>}
 */
export const parseAndDeduplicateCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    const seenEmails = new Set();
    let totalRows = 0;
    let duplicateRows = 0;
    let invalidRows = 0;

    fs.createReadStream(filePath)
      .pipe(csvParser({ mapHeaders: ({ header }) => header.trim() }))
      .on('data', (data) => {
        totalRows++;

        // Find email field
        const emailKey = findMatchingKey(data, [
          'email',
          'emailaddress',
          'e-mail',
          'mail',
          'recipient',
          'contact_email',
        ]);
        // Find name field
        const nameKey = findMatchingKey(data, [
          'name',
          'fullname',
          'first_name',
          'firstname',
          'user_name',
          'username',
          'contact',
        ]);

        let rawEmail = emailKey ? data[emailKey] : null;

        // Fallback: If no explicit email header, check values for an email string
        if (!rawEmail) {
          for (const val of Object.values(data)) {
            if (typeof val === 'string' && val.includes('@') && EMAIL_REGEX.test(val.trim())) {
              rawEmail = val;
              break;
            }
          }
        }

        if (!rawEmail || typeof rawEmail !== 'string') {
          invalidRows++;
          return;
        }

        const email = rawEmail.trim().toLowerCase();

        // Validate email format
        if (!EMAIL_REGEX.test(email)) {
          invalidRows++;
          return;
        }

        // Deduplication
        if (seenEmails.has(email)) {
          duplicateRows++;
          return;
        }

        seenEmails.add(email);
        const name = nameKey && data[nameKey] ? String(data[nameKey]).trim() : '';

        results.push({
          email,
          name,
          category: 'unclassified',
          status: 'active',
        });
      })
      .on('end', () => {
        // Remove temp file
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (e) {
          console.warn('Failed to delete temp CSV:', e.message);
        }

        resolve({
          records: results,
          stats: {
            totalRows,
            validRows: results.length,
            duplicateRows,
            invalidRows,
          },
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
};
