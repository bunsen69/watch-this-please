const fs = require('fs');
const path = require('path');

function logRun({ logDir, url, totalRequests, concurrency, timeoutMs, result }) {
  fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, 'runs.log');

  const entry = {
    timestamp: new Date().toISOString(),
    url,
    totalRequests,
    concurrency,
    timeoutMs,
    sent: result.sent,
    aborted: result.aborted,
    stats: result.stats
  };

  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf-8');
  return logPath;
}

module.exports = { logRun };
