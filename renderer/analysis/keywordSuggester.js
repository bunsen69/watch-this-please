import { STOPWORDS, CONDITION_WORDS, SYNONYM_HINTS } from './data.js';

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

export function suggestKeywords(title, description, itemSpecifics = {}) {
  const suggestions = [];
  const titleLower = (title || '').toLowerCase();
  const descLower = (description || '').toLowerCase();
  const combined = `${titleLower} ${descLower}`;

  const titleTokens = new Set(tokenize(title).filter((t) => !STOPWORDS.has(t)));

  Object.entries(itemSpecifics || {}).forEach(([key, value]) => {
    if (!value) return;
    const valueLower = String(value).toLowerCase();
    if (!titleLower.includes(valueLower)) {
      suggestions.push({
        keyword: String(value),
        reason: `Item specific "${key}" isn't reflected in your title — buyers filter and search by these attributes.`
      });
    }
  });

  const hasCondition = CONDITION_WORDS.some((word) => combined.includes(word));
  if (!hasCondition) {
    suggestions.push({
      keyword: '(condition, e.g. "New", "Used", "Pre-Owned")',
      reason: 'Condition terms are heavily searched and filtered on. Add one to the title or description if accurate.'
    });
  }

  SYNONYM_HINTS.forEach(({ match, suggest }) => {
    if (match.test(title || '')) {
      const missing = suggest.filter((word) => !combined.includes(word.toLowerCase()));
      missing.forEach((word) => {
        suggestions.push({
          keyword: word,
          reason: `Buyers sometimes search "${word}" instead of the term already in your title — consider mentioning it in the description.`
        });
      });
    }
  });

  if (titleTokens.size < 5) {
    suggestions.push({
      keyword: '(more descriptive attributes)',
      reason: 'Title has few distinct keywords. Add attributes like brand, model, size, color, or material to match more searches.'
    });
  }

  const seen = new Set();
  const deduped = suggestions.filter((s) => {
    const key = s.keyword.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped;
}
