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
  }
});
