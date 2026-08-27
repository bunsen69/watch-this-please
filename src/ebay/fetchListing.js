const cheerio = require('cheerio');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

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

async function fetchListing(rawUrl) {
  const url = (rawUrl || '').trim();
  if (!url) throw new Error('Please paste an eBay listing URL.');
  if (!isLikelyEbayItemUrl(url)) {
    throw new Error('That does not look like an ebay.com listing URL.');
  }

  let response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml'
      }
    });
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

module.exports = { fetchListing };
