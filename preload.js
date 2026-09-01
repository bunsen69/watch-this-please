const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  fetchListing: (payload) => ipcRenderer.invoke('fetch-listing', payload),
  importCsv: () => ipcRenderer.invoke('import-csv'),

  loadTestLimits: () => ipcRenderer.invoke('loadtest:limits'),
  startLoadTest: (config) => ipcRenderer.send('loadtest:start', config),
  stopLoadTest: () => ipcRenderer.send('loadtest:stop'),
  onLoadTestProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('loadtest:progress', handler);
    return () => ipcRenderer.removeListener('loadtest:progress', handler);
  },
  onLoadTestDone: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('loadtest:done', handler);
    return () => ipcRenderer.removeListener('loadtest:done', handler);
  },
  onLoadTestError: (callback) => {
    const handler = (_event, message) => callback(message);
    ipcRenderer.on('loadtest:error', handler);
    return () => ipcRenderer.removeListener('loadtest:error', handler);
  },

  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  toggleMaximizeWindow: () => ipcRenderer.send('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isWindowMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onWindowMaximizedChanged: (callback) => {
    const handler = (_event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window:maximized-changed', handler);
    return () => ipcRenderer.removeListener('window:maximized-changed', handler);
  }
});
