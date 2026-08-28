import { STOPWORDS } from './data.js';

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\s.-]?){9,13}/;
const URL_RE_GLOBAL = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;

export function analyzeDescription(description, title) {
  const issues = [];
  const text = (description || '').trim();
  const plainText = text.replace(/<[^>]*>/g, ' ');
  const words = plainText.split(/\s+/).filter(Boolean);

  if (!text) {
    return {
      score: 0,
      wordCount: 0,
      issues: [{ severity: 'critical', message: 'Description is empty.' }]
    };
  }

  if (words.length < 40) {
    issues.push({
      severity: 'warning',
      message: `Description is short (${words.length} words). Add more detail on features, specs, and condition — thin descriptions rank and convert worse.`
    });
  }

  if (EMAIL_RE.test(plainText)) {
    issues.push({
      severity: 'critical',
      message: 'Description appears to contain an email address. eBay policy prohibits contact info in listings and can get the listing suppressed or removed.'
    });
  }

  if (PHONE_RE.test(plainText.replace(/[$0-9]{1,3}\.[0-9]{2}/g, ''))) {
    issues.push({
      severity: 'tip',
      message: 'Possible phone number detected — double check this isn\'t contact info, which violates eBay policy.'
    });
  }

  const links = plainText.match(URL_RE_GLOBAL) || [];
  const offEbayLinks = links.filter((link) => !/ebay\.[a-z.]+/i.test(link));
  if (offEbayLinks.length > 0) {
    issues.push({
      severity: 'critical',
      message: `Description links off eBay (${offEbayLinks[0]}). Links to outside sites violate eBay policy and can hurt or remove the listing.`
    });
  }

  const hasStructure = /<li>|<br\s*\/?>|\n\s*\n/i.test(text) || text.split(/\n/).length > 3;
  if (!hasStructure && words.length > 60) {
    issues.push({
      severity: 'tip',
      message: 'Description reads as one big block of text. Use short paragraphs or bullet points — most eBay traffic is mobile and scanning matters.'
    });
  }

  if (plainText === plainText.toUpperCase() && /[a-z]/i.test(plainText)) {
    issues.push({ severity: 'warning', message: 'Description is in ALL CAPS.' });
  }

  const titleTokens = new Set(tokenize(title).filter((t) => !STOPWORDS.has(t) && t.length > 2));
  const descTokens = new Set(tokenize(plainText));
  const overlap = [...titleTokens].filter((t) => descTokens.has(t));
  const overlapRatio = titleTokens.size > 0 ? overlap.length / titleTokens.size : 1;

  if (titleTokens.size > 0 && overlapRatio < 0.4) {
    issues.push({
      severity: 'tip',
      message: 'Few of your title keywords appear in the description. Naturally reusing them helps relevance for eBay search.'
    });
  } else if (titleTokens.size > 0) {
    issues.push({ severity: 'good', message: 'Title keywords are well represented in the description.' });
  }

  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'critical') score -= 35;
    else if (issue.severity === 'warning') score -= 15;
    else if (issue.severity === 'tip') score -= 5;
  }
  score = Math.max(0, Math.min(100, score));

  return { score, wordCount: words.length, issues };
}
