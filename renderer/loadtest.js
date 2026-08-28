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
  [urlInput, countInput, concurrencyInput, timeoutInput, confirmHostInput].forEach((el) => { el.disabled = isRunning; });
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

  window.api.startLoadTest({ url, totalRequests, concurrency, timeoutMs });
});

stopBtn.addEventListener('click', () => {
  window.api.stopLoadTest();
  statusEl.textContent = 'Stopping...';
  statusEl.className = 'status';
});

updateStartEnabled();
