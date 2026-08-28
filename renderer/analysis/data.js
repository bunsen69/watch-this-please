export const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'of', 'with', 'in', 'on', 'to', 'is',
  'it', 'this', 'that', 'by', 'at', 'as', 'be', 'are', 'was', 'were', 'from',
  'your', 'our', 'you', 'we', 'not', 'no', 'so', 'if', 'but', 'has', 'have'
]);

export const SPAM_PHRASES = [
  'l@@k', 'l@@k!', 'wow', 'must see', 'must have', 'grab it', 'hot item',
  'no reserve', 'best deal', 'best price', 'awesome', 'super rare', 'ultra rare'
];

export const CONDITION_WORDS = [
  'new', 'used', 'pre-owned', 'preowned', 'refurbished', 'open box',
  'sealed', 'nwt', 'nib', 'vintage', 'brand new'
];

// Small heuristic synonym dictionary — not live search-volume data,
// just common alternate terms buyers search for on eBay.
export const SYNONYM_HINTS = [
  { match: /\bsneakers?\b/i, suggest: ['shoes', 'trainers'] },
  { match: /\bphone case\b/i, suggest: ['cover', 'protector'] },
  { match: /\blaptop\b/i, suggest: ['notebook'] },
  { match: /\bcouch\b/i, suggest: ['sofa'] },
  { match: /\bt-?shirt\b/i, suggest: ['tee'] },
  { match: /\bheadphones?\b/i, suggest: ['earphones', 'headset'] },
  { match: /\bnecklace\b/i, suggest: ['pendant', 'chain'] },
  { match: /\bbag\b/i, suggest: ['purse', 'handbag'] },
  { match: /\bwatch\b/i, suggest: ['wristwatch', 'timepiece'] },
  { match: /\bfigure\b/i, suggest: ['figurine', 'collectible'] }
];

export const TITLE_MAX_CHARS = 80;
