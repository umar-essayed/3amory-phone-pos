const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  getPrinters: () => ipcRenderer.invoke('printer:get-printers'),
  printRaw: (data) => ipcRenderer.invoke('printer:print-raw', data),
  printSilent: (options) => ipcRenderer.invoke('printer:print-silent', options),
  kickDrawer: () => ipcRenderer.invoke('printer:kick-drawer'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
});
