/**
 * SmartBiz / Accounts360 - Electron Main Process
 * Manages application lifecycle, window instantiation, single-instance mutex,
 * native hardware ID extraction, silent POS thermal printing, and backup dialogs.
 */

const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const net = require("net");
const { spawn } = require("child_process");

// Set Desktop Mode Flags
process.env.ACCOUNTS360_DESKTOP = "true";
process.env.DESKTOP_MODE = "true";

let mainWindow = null;
let serverProcess = null;
const DEFAULT_PORT = 3600;

// Prevent duplicate instances (Single-Instance Mutex Lock)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

/**
 * Checks if a TCP port is in use on localhost.
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once("error", () => resolve(true))
      .once("listening", () => {
        tester.once("close", () => resolve(false)).close();
      })
      .listen(port, "127.0.0.1");
  });
}

/**
 * Launches local Next.js server if not already running.
 */
async function startLocalServer(port) {
  const inUse = await isPortInUse(port);
  if (inUse) {
    console.log(`[DesktopMain] Server already responding on port ${port}.`);
    return;
  }

  console.log(`[DesktopMain] Starting local server process on port ${port}...`);
  const rootDir = path.resolve(__dirname, "..");

  // Look for standalone server or run local npm start
  const standaloneServer = path.join(rootDir, ".next", "standalone", "server.js");
  if (fs.existsSync(standaloneServer)) {
    serverProcess = spawn(process.execPath, [standaloneServer], {
      cwd: path.dirname(standaloneServer),
      env: { ...process.env, PORT: String(port) },
      stdio: "pipe",
    });
  } else {
    // Development / Local mode fallback
    serverProcess = spawn("npm", ["run", "start"], {
      cwd: rootDir,
      shell: true,
      env: { ...process.env, PORT: String(port) },
      stdio: "pipe",
    });
  }

  // Wait for server to bind
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const active = await isPortInUse(port);
    if (active) {
      console.log(`[DesktopMain] Server successfully bound to port ${port}.`);
      return;
    }
  }
}

function createMainWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: "Accounts360 - Complete Business Accounting, POS & Invoicing",
    icon: path.join(__dirname, "assets", "icon.ico"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);

  const startUrl = `http://127.0.0.1:${port}`;
  console.log(`[DesktopMain] Loading main window from: ${startUrl}`);
  mainWindow.loadURL(startUrl);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle("get-machine-id", async () => {
  try {
    const { getMachineId } = require("../src/lib/hardwareId");
    return getMachineId();
  } catch (err) {
    return "MCH-0000-0000-0000";
  }
});

ipcMain.handle("get-printers", async () => {
  if (!mainWindow) return [];
  return await mainWindow.webContents.getPrintersAsync();
});

ipcMain.handle("print-thermal", async (_event, options) => {
  if (!mainWindow) return { success: false, error: "No active window" };
  try {
    await mainWindow.webContents.print({
      silent: options?.silent !== false,
      printBackground: true,
      deviceName: options?.deviceName || "",
      pageSize: { width: 80000, height: 297000 }, // 80mm roll width
      margins: { marginType: "none" },
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("export-backup-file", async (_event, data) => {
  if (!mainWindow) return { success: false };
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "Save Accounts360 Database Backup (.sbz)",
    defaultPath: data.filename || "Accounts360_Backup.sbz",
    filters: [{ name: "Accounts360 Backup", extensions: ["sbz"] }],
  });

  if (canceled || !filePath) return { success: false, canceled: true };

  try {
    fs.writeFileSync(filePath, data.payloadString, "utf8");
    return { success: true, filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("import-backup-file", async () => {
  if (!mainWindow) return { success: false };
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Select Accounts360 Backup File to Restore (.sbz)",
    filters: [{ name: "Accounts360 Backup", extensions: ["sbz"] }],
    properties: ["openFile"],
  });

  if (canceled || !filePaths || filePaths.length === 0) return { success: false, canceled: true };

  try {
    const content = fs.readFileSync(filePaths[0], "utf8");
    return { success: true, content, filePath: filePaths[0] };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.on("window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("window-maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on("window-close", () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle("is-maximized", () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// App Lifecycle
app.whenReady().then(async () => {
  const port = process.env.PORT || DEFAULT_PORT;
  await startLocalServer(port);
  createMainWindow(port);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(port);
    }
  });
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
