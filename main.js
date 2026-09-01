const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { fetchListing } = require('./src/ebay/fetchListing');
const { parseCsv } = require('./src/csv/parseCsv');
const { LoadTestRunner, MAX_REQUESTS, MAX_CONCURRENCY } = require('./src/loadtest/runner');
const { logRun } = require('./src/loadtest/logRun');

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: 'eBay Listing SEO Optimizer',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.on('maximize', () => win.webContents.send('window:maximized-changed', true));
  win.on('unmaximize', () => win.webContents.send('window:maximized-changed', false));

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('fetch-listing', async (_event, payload) => {
  const { url, randomizeHeaders } = payload || {};
  try {
    const data = await fetchListing(url, { randomizeHeaders });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('import-csv', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Import listings CSV',
    properties: ['openFile'],
    filters: [{ name: 'CSV files', extensions: ['csv'] }]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, canceled: true };
  }

  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    const rows = parseCsv(raw);
    return { ok: true, rows, fileName: path.basename(result.filePaths[0]) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

let activeLoadTest = null;
const loadTestLogDir = path.join(app.getPath('userData'), 'loadtest-logs');

ipcMain.on('loadtest:start', (event, config) => {
  try {
    if (activeLoadTest) activeLoadTest.stop();

    activeLoadTest = new LoadTestRunner({
      url: config.url,
      totalRequests: config.totalRequests,
      concurrency: config.concurrency,
      timeoutMs: config.timeoutMs,
      headerLines: config.headerLines,
      cookie: config.cookie,
      randomizeHeaders: config.randomizeHeaders,
      randomizeCookies: config.randomizeCookies,
      onProgress: (progress) => event.sender.send('loadtest:progress', progress),
      onDone: (result) => {
        let logPath = null;
        try {
          logPath = logRun({
            logDir: loadTestLogDir,
            url: config.url,
            totalRequests: config.totalRequests,
            concurrency: config.concurrency,
            timeoutMs: config.timeoutMs,
            randomizeHeaders: config.randomizeHeaders,
            randomizeCookies: config.randomizeCookies,
            result
          });
        } catch (logErr) {
          // Logging failure shouldn't hide the test result from the user.
        }
        event.sender.send('loadtest:done', { ...result, logPath });
        activeLoadTest = null;
      }
    });
    activeLoadTest.start();
  } catch (err) {
    event.sender.send('loadtest:error', err.message);
  }
});

ipcMain.on('loadtest:stop', () => {
  if (activeLoadTest) activeLoadTest.stop();
});

ipcMain.handle('loadtest:limits', () => ({ maxRequests: MAX_REQUESTS, maxConcurrency: MAX_CONCURRENCY }));

ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('window:toggle-maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});

ipcMain.on('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.handle('window:is-maximized', (event) => {
  return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false;
});
