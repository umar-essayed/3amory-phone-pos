const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,

  // Printer APIs
  getPrinters: () => ipcRenderer.invoke('printer:get-printers'),
  printRaw: (data) => ipcRenderer.invoke('printer:print-raw', data),
  printSilent: (options) => ipcRenderer.invoke('printer:print-silent', options),
  kickDrawer: () => ipcRenderer.invoke('printer:kick-drawer'),

  // Window Controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Storage, Backups & Database Mirrors
  saveSnapshotBackup: (payload) => ipcRenderer.invoke('backup:save-snapshot', payload),
  openBackupsFolder: () => ipcRenderer.invoke('backup:open-folder'),
  saveDatabaseMirror: (jsonData) => ipcRenderer.invoke('db:save-mirror', jsonData),
  loadDatabaseMirror: () => ipcRenderer.invoke('db:load-mirror'),
  getStoragePaths: () => ipcRenderer.invoke('storage:get-paths'),

  // System Logging & Audit APIs
  logInit: (message, isError, data) =>
    ipcRenderer.invoke('logger:log-init', { message, isError, data }),
  logPrinter: (payload) =>
    ipcRenderer.invoke('logger:log-printer', payload),
  logSystemError: (payload) =>
    ipcRenderer.invoke('logger:log-error', payload),
  saveInvoicePreview: (payload) =>
    ipcRenderer.invoke('logger:save-invoice-preview', payload),
  openLogsFolder: () =>
    ipcRenderer.invoke('logger:open-logs-folder'),
  getLogPaths: () =>
    ipcRenderer.invoke('logger:get-log-paths'),
});
