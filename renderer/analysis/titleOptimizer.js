import { SPAM_PHRASES, TITLE_MAX_CHARS, STOPWORDS } from './data.js';

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

export function analyzeTitle(title, itemSpecifics = {}) {
  const issues = [];
  const trimmed = (title || '').trim();
  const charCount = trimmed.length;

  if (!trimmed) {
    return {
      score: 0,
      charCount: 0,
      issues: [{ severity: 'critical', message: 'Title is empty.' }]
    };
  }

  if (charCount > TITLE_MAX_CHARS) {
    issues.push({
      severity: 'critical',
      message: `Title is ${charCount} characters — over eBay's ${TITLE_MAX_CHARS}-character limit and will be truncated.`
    });
  } else if (charCount < TITLE_MAX_CHARS * 0.6) {
    issues.push({
      severity: 'warning',
      message: `Only using ${charCount}/${TITLE_MAX_CHARS} characters. eBay's search (Cassini) rewards fuller, keyword-rich titles — try adding brand, size, color, model, or material.`
    });
  } else {
    issues.push({
      severity: 'good',
      message: `Using ${charCount}/${TITLE_MAX_CHARS} characters — good use of available space.`
    });
  }

  if (trimmed === trimmed.toUpperCase() && /[a-z]/i.test(trimmed)) {
    issues.push({
      severity: 'warning',
      message: 'Title is in ALL CAPS. Mixed case reads better and avoids looking spammy to buyers.'
    });
  }

  const lower = trimmed.toLowerCase();
  const foundSpam = SPAM_PHRASES.filter((phrase) => lower.includes(phrase));
  if (foundSpam.length > 0) {
    issues.push({
      severity: 'warning',
      message: `Avoid filler/spam phrases that waste character space and don't match real searches: "${foundSpam.join('", "')}".`
    });
  }

  const symbolMatches = trimmed.match(/[!*~^${}[\]|<>]/g) || [];
  if (symbolMatches.length > 0) {
    issues.push({
      severity: 'warning',
      message: `Special characters (${[...new Set(symbolMatches)].join(' ')}) don't help search matching and use up character space.`
    });
  }

  const tokens = tokenize(trimmed).filter((t) => !STOPWORDS.has(t) && t.length > 2);
  const counts = {};
  tokens.forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
  const repeated = Object.entries(counts).filter(([, count]) => count > 2).map(([word]) => word);
  if (repeated.length > 0) {
    issues.push({
      severity: 'warning',
      message: `Word(s) repeated more than twice ("${repeated.join('", "')}") — looks like keyword stuffing to eBay's search algorithm.`
    });
  }

  const missingSpecifics = Object.entries(itemSpecifics || {}).filter(([key, value]) => {
    if (!value) return false;
    const keyLower = key.toLowerCase();
    if (!/brand|model|size|color|colour|material|style/i.test(keyLower)) return false;
    return !lower.includes(String(value).toLowerCase());
  });
  if (missingSpecifics.length > 0) {
    issues.push({
      severity: 'tip',
      message: `Consider working these item specifics into the title for extra searchability: ${missingSpecifics
        .map(([k, v]) => `${v} (${k})`)
        .join(', ')}.`
    });
  }

  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'critical') score -= 35;
    else if (issue.severity === 'warning') score -= 15;
    else if (issue.severity === 'tip') score -= 5;
  }
  score = Math.max(0, Math.min(100, score));

  return { score, charCount, issues };
}
