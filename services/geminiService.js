import { GoogleGenAI } from '@google/genai';
import { Setting } from '../models/Setting.js';

// Common personal email domains for fast heuristic fallback / verification
const COMMON_PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.co.uk',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'zoho.com',
  'mail.com',
  'yandex.com',
  'gmx.com',
  'rediffmail.com',
]);

/**
 * Fallback classification using domain analysis
 */
export const classifyByDomainHeuristic = (emailList) => {
  return emailList.map((item) => {
    const email = typeof item === 'string' ? item : item.email;
    const domain = email.split('@')[1]?.toLowerCase() || '';
    const isPersonal = COMMON_PERSONAL_DOMAINS.has(domain);
    return {
      email,
      category: isPersonal ? 'individual' : 'business',
      confidence: 0.9,
      reason: isPersonal ? 'Public mail provider domain' : 'Custom organization/corporate domain',
    };
  });
};

/**
 * Classifies a batch of emails using Google Gemini AI
 * @param {Array<{email: string, name?: string}>} emails
 * @param {string} [customApiKey]
 * @returns {Promise<Array<{email: string, category: 'business'|'individual', confidence: number, reason: string}>>}
 */
export const classifyEmailsWithGemini = async (emails, customApiKey = null) => {
  if (!emails || emails.length === 0) return [];

  // Determine API key from parameter, DB setting, or process.env
  let apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    try {
      const setting = await Setting.findOne({ key: 'global' });
      if (setting && setting.geminiApiKey) {
        apiKey = setting.geminiApiKey;
      }
    } catch (e) {
      console.warn('Could not query DB for Gemini key:', e.message);
    }
  }

  // If no Gemini key is set, use domain heuristic fallback
  if (!apiKey) {
    console.log('ℹ️ No GEMINI_API_KEY provided. Using domain heuristic classification fallback.');
    return classifyByDomainHeuristic(emails);
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const emailItems = emails.map((e, index) => `${index + 1}. ${typeof e === 'string' ? e : e.email}`).join('\n');

    const prompt = `You are an expert AI data classifier for an email campaign manager.
Classify each of the following email addresses into either "business" or "individual".

Guidelines:
- "business": Custom domain emails, corporate addresses, department addresses (e.g. info@microsoft.com, sales@amazon.com, john.doe@stripe.com, support@company.org, contact@startup.io).
- "individual": Personal email addresses on public providers (e.g. @gmail.com, @yahoo.com, @hotmail.com, @outlook.com, @icloud.com, @proton.me, @aol.com) OR personal student/freelance accounts.

Emails to classify:
${emailItems}

Respond with a valid JSON array only containing objects with:
- "email": the exact email string
- "category": strictly either "business" or "individual"
- "reason": a brief 3-5 word rationale (e.g. "Personal Gmail domain", "Corporate domain")`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Empty response from Gemini API');
    }

    const parsed = JSON.parse(responseText);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        email: item.email?.toLowerCase().trim(),
        category: item.category?.toLowerCase() === 'business' ? 'business' : 'individual',
        reason: item.reason || 'AI classified',
        confidence: 0.95,
      }));
    }

    // If unexpected structure, fallback
    return classifyByDomainHeuristic(emails);
  } catch (error) {
    console.error('❌ Gemini API classification error:', error.message);
    console.log('🔄 Falling back to domain heuristic classification...');
    return classifyByDomainHeuristic(emails);
  }
};
