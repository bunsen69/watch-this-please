const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  fetchListing: (url) => ipcRenderer.invoke('fetch-listing', url),
  importCsv: () => ipcRenderer.invoke('import-csv')
});
