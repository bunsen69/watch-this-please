// ---- view switching (SEO Optimizer <-> Load Test) ----
const viewNavButtons = document.querySelectorAll('.view-nav-btn');
const views = {
  seo: document.getElementById('view-seo'),
  loadtest: document.getElementById('view-loadtest')
};
const appTitle = document.getElementById('app-title');
const appSubtitle = document.getElementById('app-subtitle');
const COPY = {
  seo: {
    title: 'eBay Listing SEO Optimizer',
    subtitle: 'Improve your title, keywords, and description before you publish.'
  },
  loadtest: {
    title: 'Load Test',
    subtitle: 'Send a burst of requests at infrastructure you own to see how it holds up.'
  }
};

viewNavButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    viewNavButtons.forEach((b) => b.classList.toggle('active', b === btn));
    Object.entries(views).forEach(([key, el]) => el.classList.toggle('hidden', key !== btn.dataset.view));
    appTitle.textContent = COPY[btn.dataset.view].title;
    appSubtitle.textContent = COPY[btn.dataset.view].subtitle;
  });
});

// ---- load test form ----
const urlInput = document.getElementById('lt-url');
const countInput = document.getElementById('lt-count');
const concurrencyInput = document.getElementById('lt-concurrency');
const timeoutInput = document.getElementById('lt-timeout');
const headersInput = document.getElementById('lt-headers');
const cookieInput = document.getElementById('lt-cookie');
const randomizeHeadersInput = document.getElementById('lt-randomize-headers');
const randomizeCookiesInput = document.getElementById('lt-randomize-cookies');
const confirmHostInput = document.getElementById('lt-confirm-host');
const confirmHint = document.getElementById('lt-confirm-hint');
const startBtn = document.getElementById('lt-start-btn');
const stopBtn = document.getElementById('lt-stop-btn');
const statusEl = document.getElementById('lt-status');

const emptyState = document.getElementById('lt-empty-state');
const resultsEl = document.getElementById('lt-results');
const progressFill = document.getElementById('lt-progress-fill');
const progressLabel = document.getElementById('lt-progress-label');
const statSuccess = document.getElementById('lt-stat-success');
const statClient = document.getElementById('lt-stat-client');
const statServer = document.getElementById('lt-stat-server');
const statRefused = document.getElementById('lt-stat-refused');
const statTimeout = document.getElementById('lt-stat-timeout');
const statLatency = document.getElementById('lt-stat-latency');
const interpretationEl = document.getElementById('lt-interpretation');

// ---- one-off generation for the Custom headers / Cookie fields ----
// Separate from the "Randomize headers/cookies" checkboxes above, which
// re-randomize automatically on every request during a run. These buttons
// instead produce a single realistic set the user can inspect or edit
// before running, using the browser's own crypto (no IPC round trip needed).
const GEN_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'
];
const GEN_ACCEPT_LANGUAGES = ['en-US,en;q=0.9', 'en-GB,en;q=0.9', 'es-ES,es;q=0.9', 'fr-FR,fr;q=0.9', 'de-DE,de;q=0.9'];
const GEN_ACCEPTS = [
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'application/json, text/plain, */*',
  '*/*'
];
const GEN_ACCEPT_ENCODINGS = ['gzip, deflate, br', 'gzip, deflate'];

function genPick(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

function genRandomHex(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function generateHeaderLines() {
  return [
    `User-Agent: ${genPick(GEN_USER_AGENTS)}`,
    `Accept: ${genPick(GEN_ACCEPTS)}`,
    `Accept-Language: ${genPick(GEN_ACCEPT_LANGUAGES)}`,
    `Accept-Encoding: ${genPick(GEN_ACCEPT_ENCODINGS)}`
  ].join('\n');
}

function generateCookieString() {
  return `session_id=${genRandomHex(16)}; visitor_id=${genRandomHex(8)}`;
}

document.getElementById('lt-generate-headers-btn').addEventListener('click', () => {
  headersInput.value = generateHeaderLines();
});

document.getElementById('lt-generate-cookie-btn').addEventListener('click', () => {
  cookieInput.value = generateCookieString();
});

let limits = { maxRequests: 3333, maxConcurrency: 200 };
let running = false;

window.api.loadTestLimits().then((l) => {
  limits = l;
  document.getElementById('lt-count-max').textContent = `(max ${limits.maxRequests})`;
  document.getElementById('lt-concurrency-max').textContent = `(max ${limits.maxConcurrency})`;
});

function targetHostname() {
  try {
    return new URL(urlInput.value.trim()).hostname;
  } catch {
    return null;
  }
}

function updateStartEnabled() {
  const hostname = targetHostname();
  const typed = confirmHostInput.value.trim();
  const hostMatches = hostname !== null && typed.toLowerCase() === hostname.toLowerCase();

  confirmHint.textContent = hostname === null
    ? ''
    : hostMatches
      ? ''
      : `Type "${hostname}" exactly to confirm.`;

  startBtn.disabled = running || !urlInput.value.trim() || !hostMatches;
}

confirmHostInput.addEventListener('input', updateStartEnabled);
urlInput.addEventListener('input', updateStartEnabled);

function setRunning(isRunning) {
  running = isRunning;
  startBtn.style.display = isRunning ? 'none' : '';
  stopBtn.style.display = isRunning ? '' : 'none';
  [
    urlInput, countInput, concurrencyInput, timeoutInput, headersInput, cookieInput,
    randomizeHeadersInput, randomizeCookiesInput, confirmHostInput,
    document.getElementById('lt-generate-headers-btn'), document.getElementById('lt-generate-cookie-btn')
  ].forEach((el) => { el.disabled = isRunning; });
  updateStartEnabled();
}

function renderProgress(sent, total, stats) {
  emptyState.classList.add('hidden');
  resultsEl.classList.remove('hidden');

  const pct = total > 0 ? Math.min(100, (sent / total) * 100) : 0;
  progressFill.style.width = `${pct}%`;
  progressLabel.textContent = `${sent} / ${total}`;

  statSuccess.textContent = stats.success;
  statClient.textContent = stats.clientError;
  statServer.textContent = stats.serverError;
  statRefused.textContent = stats.refused;
  statTimeout.textContent = stats.timeout;
  statLatency.textContent = stats.avgLatencyMs != null ? `${stats.avgLatencyMs}ms` : '—';
}

function average(nums) {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function renderInterpretation(result) {
  const { stats, sent, latencies } = result;
  const items = [];

  if (stats.refused > 0) {
    items.push({
      severity: 'good',
      message: `${stats.refused} request(s) were refused/reset at the connection level — a strong signal your firewall, load balancer, or rate limiter is actively dropping this traffic.`
    });
  }
  if (stats.clientError > 0) {
    items.push({
      severity: 'tip',
      message: `${stats.clientError} request(s) got a 4xx response — often a WAF or rate limiter responding with "too many requests" (429) or "forbidden" (403) rather than dropping the connection outright.`
    });
  }
  if (stats.timeout > 0) {
    items.push({
      severity: 'tip',
      message: `${stats.timeout} request(s) timed out — could mean the server is silently dropping packets (a common firewall behavior) or is simply overloaded.`
    });
  }
  if (stats.success === sent && sent > 0) {
    items.push({
      severity: 'warning',
      message: `All ${sent} requests succeeded (2xx–3xx). If you expected throttling to kick in, check your rate limiter/WAF configuration — it may not be triggering on request volume from a single source.`
    });
  }
  if (stats.serverError > 0) {
    items.push({
      severity: 'warning',
      message: `${stats.serverError} request(s) got a 5xx response — the server itself, or a backend behind your load balancer, may be struggling under this load.`
    });
  }

  const avg = average(latencies);
  if (avg !== null) {
    items.push({ severity: 'good', message: `Average response latency across completed requests: ${avg}ms.` });
  }

  if (result.logPath) {
    items.push({ severity: 'good', message: `This run was logged to: ${result.logPath}` });
  }

  interpretationEl.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = item.severity;
    li.innerHTML = `<span class="badge">${item.severity}</span>${item.message}`;
    interpretationEl.appendChild(li);
  });
}

let removeProgressListener = null;
let removeDoneListener = null;
let removeErrorListener = null;

startBtn.addEventListener('click', () => {
  const url = urlInput.value.trim();
  const totalRequests = parseInt(countInput.value, 10) || 0;
  const concurrency = parseInt(concurrencyInput.value, 10) || 1;
  const timeoutMs = parseInt(timeoutInput.value, 10) || 5000;

  if (!/^https?:\/\//i.test(url)) {
    statusEl.textContent = 'Enter a full http:// or https:// URL.';
    statusEl.className = 'status error';
    return;
  }

  statusEl.textContent = 'Running...';
  statusEl.className = 'status';
  setRunning(true);

  if (removeProgressListener) removeProgressListener();
  if (removeDoneListener) removeDoneListener();
  if (removeErrorListener) removeErrorListener();

  removeProgressListener = window.api.onLoadTestProgress(({ sent, total, stats }) => {
    renderProgress(sent, total, stats);
  });

  removeDoneListener = window.api.onLoadTestDone((result) => {
    renderProgress(result.sent, result.total, result.stats);
    renderInterpretation(result);
    statusEl.textContent = result.aborted ? `Stopped after ${result.sent} request(s).` : `Done — sent ${result.sent} request(s).`;
    statusEl.className = 'status success';
    setRunning(false);
  });

  removeErrorListener = window.api.onLoadTestError((message) => {
    statusEl.textContent = message;
    statusEl.className = 'status error';
    setRunning(false);
  });

  window.api.startLoadTest({
    url,
    totalRequests,
    concurrency,
    timeoutMs,
    headerLines: headersInput.value,
    cookie: cookieInput.value,
    randomizeHeaders: randomizeHeadersInput.checked,
    randomizeCookies: randomizeCookiesInput.checked
  });
});

stopBtn.addEventListener('click', () => {
  window.api.stopLoadTest();
  statusEl.textContent = 'Stopping...';
  statusEl.className = 'status';
});

updateStartEnabled();
