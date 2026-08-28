const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { fetchListing } = require('./src/ebay/fetchListing');
const { parseCsv } = require('./src/csv/parseCsv');

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: 'eBay Listing SEO Optimizer',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

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

ipcMain.handle('fetch-listing', async (_event, url) => {
  try {
    const data = await fetchListing(url);
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
