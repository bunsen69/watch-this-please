const http = require('http');
const https = require('https');
const crypto = require('crypto');

const MAX_REQUESTS = 3333;
const MAX_CONCURRENCY = 200;

// Targets that are never allowed, regardless of confirmation: eBay itself
// (this tool ships inside an eBay listing app and must never be pointed at
// eBay's own infrastructure) and the cloud metadata endpoint (a common SSRF
// target, never a legitimate load-test target).
function isBlockedHost(hostname) {
  if (/(^|\.)ebay\.[a-z.]+$/i.test(hostname)) return true;
  if (hostname === '169.254.169.254') return true;
  return false;
}

// Headers that influence which client made a request are deliberately not
// randomizable here — this pool only covers User-Agent/Accept-Language, for
// simulating traffic diversity, never IP-indicating headers.
const USER_AGENT_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/128.0.0.0 Safari/537.36'
];

const ACCEPT_LANGUAGE_POOL = ['en-US,en;q=0.9', 'en-GB,en;q=0.9', 'es-ES,es;q=0.9', 'fr-FR,fr;q=0.9', 'de-DE,de;q=0.9'];

function pick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomCookieValue() {
  return crypto.randomBytes(16).toString('hex');
}

// Parses simple "Name: Value" per-line header text into an object. Blank
// lines and lines without a colon are ignored rather than rejected, since
// this is typed by hand in the UI.
function parseHeaderLines(text) {
  const headers = {};
  (text || '').split('\n').forEach((line) => {
    const idx = line.indexOf(':');
    if (idx === -1) return;
    const name = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (name && value) headers[name] = value;
  });
  return headers;
}

class LoadTestRunner {
  constructor({
    url, totalRequests, concurrency, timeoutMs,
    headerLines, cookie, randomizeHeaders, randomizeCookies,
    onProgress, onDone
  }) {
    this.targetUrl = new URL(url);

    if (!/^https?:$/.test(this.targetUrl.protocol)) {
      throw new Error('Only http:// and https:// URLs are supported.');
    }
    if (isBlockedHost(this.targetUrl.hostname)) {
      throw new Error('This target is not allowed. This tool is for infrastructure you own or are authorized to test.');
    }

    this.totalRequests = Math.max(1, Math.min(MAX_REQUESTS, Math.floor(totalRequests) || 0));
    this.concurrency = Math.max(1, Math.min(MAX_CONCURRENCY, Math.floor(concurrency) || 1, this.totalRequests));
    this.timeoutMs = Math.max(500, Math.min(30000, Math.floor(timeoutMs) || 5000));

    this.baseHeaders = parseHeaderLines(headerLines);
    this.baseCookie = (cookie || '').trim();
    this.randomizeHeaders = Boolean(randomizeHeaders);
    this.randomizeCookies = Boolean(randomizeCookies);

    this.onProgress = onProgress || function () {};
    this.onDone = onDone || function () {};

    this.aborted = false;
    this.sent = 0;
    this.stats = { success: 0, clientError: 0, serverError: 0, refused: 0, timeout: 0, otherError: 0 };
    this.latencies = [];
  }

  buildHeadersForRequest() {
    const headers = { ...this.baseHeaders };

    if (this.randomizeHeaders) {
      headers['User-Agent'] = pick(USER_AGENT_POOL);
      headers['Accept-Language'] = pick(ACCEPT_LANGUAGE_POOL);
    }

    if (this.randomizeCookies) {
      const randomPart = `lt_session=${randomCookieValue()}`;
      headers['Cookie'] = this.baseCookie ? `${this.baseCookie}; ${randomPart}` : randomPart;
    } else if (this.baseCookie) {
      headers['Cookie'] = this.baseCookie;
    }

    return headers;
  }

  stop() {
    this.aborted = true;
  }

  start() {
    const isHttps = this.targetUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const AgentCtor = isHttps ? https.Agent : http.Agent;
    this.agent = new AgentCtor({ keepAlive: true, maxSockets: this.concurrency });

    const runOne = () => new Promise((resolveOne) => {
      const startedAt = Date.now();
      const headers = this.buildHeadersForRequest();
      const req = client.request(this.targetUrl, { method: 'GET', agent: this.agent, timeout: this.timeoutMs, headers }, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          this.latencies.push(Date.now() - startedAt);
          if (res.statusCode >= 200 && res.statusCode < 400) this.stats.success++;
          else if (res.statusCode >= 400 && res.statusCode < 500) this.stats.clientError++;
          else this.stats.serverError++;
          resolveOne();
        });
      });

      req.on('timeout', () => {
        this.stats.timeout++;
        req.destroy();
      });

      req.on('error', (err) => {
        if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ECONNABORTED') {
          this.stats.refused++;
        } else {
          this.stats.otherError++;
        }
        resolveOne();
      });

      req.end();
    });

    const worker = async () => {
      while (!this.aborted && this.sent < this.totalRequests) {
        this.sent++;
        await runOne();
        const avgLatencyMs = this.latencies.length
          ? Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length)
          : null;
        this.onProgress({ sent: this.sent, total: this.totalRequests, stats: { ...this.stats, avgLatencyMs } });
      }
    };

    const workers = Array.from({ length: this.concurrency }, worker);

    Promise.all(workers).then(() => {
      this.agent.destroy();
      const avgLatencyMs = this.latencies.length
        ? Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length)
        : null;
      this.onDone({
        sent: this.sent,
        total: this.totalRequests,
        aborted: this.aborted,
        stats: { ...this.stats, avgLatencyMs },
        latencies: this.latencies
      });
    });
  }
}

module.exports = { LoadTestRunner, MAX_REQUESTS, MAX_CONCURRENCY, isBlockedHost, parseHeaderLines };
