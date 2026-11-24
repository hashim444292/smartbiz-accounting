/**
 * SmartBiz / Accounts360 - Electron Preload Script
 * Safely bridges Electron native capabilities to the React web interface
 * using contextIsolation and typed IPC messaging.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("accounts360Desktop", {
  isDesktop: true,
  platform: process.platform,

  // Hardware machine identifier
  getMachineId: () => ipcRenderer.invoke("get-machine-id"),

  // Native Windows printing (80mm thermal slips & A4)
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  printThermal: (options) => ipcRenderer.invoke("print-thermal", options),

  // 1-Click Backup & Restore native file dialogs
  exportBackupFile: (data) => ipcRenderer.invoke("export-backup-file", data),
  importBackupFile: () => ipcRenderer.invoke("import-backup-file"),

  // Window control actions
  minimizeWindow: () => ipcRenderer.send("window-minimize"),
  maximizeWindow: () => ipcRenderer.send("window-maximize"),
  closeWindow: () => ipcRenderer.send("window-close"),
  isMaximized: () => ipcRenderer.invoke("is-maximized"),
});
