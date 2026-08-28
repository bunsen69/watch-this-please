const http = require('http');
const https = require('https');

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

class LoadTestRunner {
  constructor({ url, totalRequests, concurrency, timeoutMs, onProgress, onDone }) {
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
    this.onProgress = onProgress || function () {};
    this.onDone = onDone || function () {};

    this.aborted = false;
    this.sent = 0;
    this.stats = { success: 0, clientError: 0, serverError: 0, refused: 0, timeout: 0, otherError: 0 };
    this.latencies = [];
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
      const req = client.request(this.targetUrl, { method: 'GET', agent: this.agent, timeout: this.timeoutMs }, (res) => {
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

module.exports = { LoadTestRunner, MAX_REQUESTS, MAX_CONCURRENCY, isBlockedHost };
