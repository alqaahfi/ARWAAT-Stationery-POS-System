// Preload for the update recovery window only (see recovery.js).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('recovery', {
  getInfo: () => ipcRenderer.invoke('recovery:get-info'),
  restore: () => ipcRenderer.invoke('recovery:restore'),
  close: () => ipcRenderer.invoke('recovery:close'),
});
