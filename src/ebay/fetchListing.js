const cheerio = require('cheerio');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Each profile is a complete, internally-consistent set of real browser
// values (UA matches its own Client Hints/Accept-Language conventions,
// rather than mixing fields from different browsers) — a mismatched
// combination is itself a bot signal, so keeping each set coherent matters
// more than just varying individual header values. Used only to look like
// an ordinary browser request when the fixed default above gets blocked,
// never to spoof identity beyond that.
const PROFILES = [
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    acceptLanguage: 'en-US,en;q=0.9',
    acceptEncoding: 'gzip, deflate, br',
    secChUa: '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    secChUaPlatform: '"Windows"'
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    acceptLanguage: 'en-US,en;q=0.9',
    acceptEncoding: 'gzip, deflate, br',
    secChUa: '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    secChUaPlatform: '"macOS"'
  },
  {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    acceptLanguage: 'en-US,en;q=0.9',
    acceptEncoding: 'gzip, deflate, br',
    secChUa: '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    secChUaPlatform: '"Linux"'
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/128.0.0.0 Safari/537.36',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    acceptLanguage: 'en-US,en;q=0.9',
    acceptEncoding: 'gzip, deflate, br',
    secChUa: '"Chromium";v="128", "Not;A=Brand";v="24", "Microsoft Edge";v="128"',
    secChUaPlatform: '"Windows"'
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    acceptLanguage: 'en-US,en;q=0.9',
    acceptEncoding: 'gzip, deflate, br',
    secChUa: null,
    secChUaPlatform: null
  },
  {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    acceptLanguage: 'en-US,en;q=0.5',
    acceptEncoding: 'gzip, deflate, br',
    secChUa: null,
    secChUaPlatform: null
  }
];

const MAX_HEADER_ATTEMPTS = 3;

function buildHeaders(profile) {
  const headers = {
    'User-Agent': profile.userAgent,
    Accept: profile.accept,
    'Accept-Language': profile.acceptLanguage,
    'Accept-Encoding': profile.acceptEncoding,
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1'
  };
  if (profile.secChUa) {
    headers['sec-ch-ua'] = profile.secChUa;
    headers['sec-ch-ua-mobile'] = '?0';
    headers['sec-ch-ua-platform'] = profile.secChUaPlatform;
  }
  return headers;
}

function shuffled(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isLikelyEbayItemUrl(url) {
  try {
    const u = new URL(url);
    return /(^|\.)ebay\.[a-z.]+$/i.test(u.hostname);
  } catch {
    return false;
  }
}

function extractJsonLdProduct($) {
  let product = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (product) return;
    let parsed;
    try {
      parsed = JSON.parse($(el).contents().text());
    } catch {
      return;
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const candidate of candidates) {
      if (candidate && (candidate['@type'] === 'Product' || candidate['@type'] === 'Offer')) {
        product = candidate;
      }
    }
  });
  return product;
}

function extractItemSpecifics($) {
  const specifics = {};

  $('.ux-labels-values').each((_, section) => {
    const label = $(section).find('.ux-labels-values__labels').first().text().trim();
    const value = $(section).find('.ux-labels-values__values').first().text().trim();
    if (label && value) specifics[label.replace(/:$/, '')] = value;
  });

  if (Object.keys(specifics).length === 0) {
    $('dl.ux-labels-values, div[data-testid="ux-labels-values"]').each((_, section) => {
      $(section)
        .find('dt')
        .each((i, dt) => {
          const label = $(dt).text().trim();
          const dd = $(dt).next('dd');
          const value = dd.text().trim();
          if (label && value) specifics[label.replace(/:$/, '')] = value;
        });
    });
  }

  return specifics;
}

async function attemptFetch(url, headers) {
  let response;
  try {
    response = await fetch(url, { headers });
  } catch (err) {
    throw new Error(`Could not reach that URL (network error): ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(
      `eBay returned status ${response.status}. The listing may be private, ended, or eBay blocked this request.`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const jsonLd = extractJsonLdProduct($);

  const title =
    (jsonLd && jsonLd.name) ||
    $('meta[property="og:title"]').attr('content') ||
    $('#itemTitle').text().trim() ||
    $('title').text().trim();

  const description =
    (jsonLd && jsonLd.description) ||
    $('meta[property="og:description"]').attr('content') ||
    '';

  const itemSpecifics = extractItemSpecifics($);

  if (!title) {
    throw new Error(
      'Fetched the page but could not find a listing title. eBay may have changed its page layout or blocked automated access — paste the title/description manually instead.'
    );
  }

  return {
    sourceUrl: url,
    title: title.trim(),
    description: (description || '').trim(),
    itemSpecifics,
    warning:
      Object.keys(itemSpecifics).length === 0
        ? 'Could not automatically detect item specifics on this page. Add them manually if you want them included in the analysis.'
        : null
  };
}

async function fetchListing(rawUrl, options = {}) {
  const url = (rawUrl || '').trim();
  if (!url) throw new Error('Please paste an eBay listing URL.');
  if (!isLikelyEbayItemUrl(url)) {
    throw new Error('That does not look like an ebay.com listing URL.');
  }

  const headerSets = options.randomizeHeaders
    ? shuffled(PROFILES).slice(0, MAX_HEADER_ATTEMPTS).map(buildHeaders)
    : [{ 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' }];

  let lastError = null;
  for (const headers of headerSets) {
    try {
      return await attemptFetch(url, headers);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
}

module.exports = { fetchListing };
