/**
 * SmartBiz / Accounts360 - Electron Main Process
 * Manages application lifecycle, window instantiation, single-instance mutex,
 * embedded Next.js server lifecycle, native hardware ID extraction,
 * silent POS thermal printing, and backup dialogs.
 */

const { app, BrowserWindow, ipcMain, dialog, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const { spawn, execSync } = require("child_process");

// Set Desktop Mode Flags
process.env.ACCOUNTS360_DESKTOP = "true";
process.env.DESKTOP_MODE = "true";

let mainWindow = null;
let serverProcess = null;
const DEFAULT_PORT = 3600;

const os = require("os");

// Setup persistent logging in %APPDATA%/Accounts360/desktop.log
let logFilePath = null;
function getLogPath() {
  if (!logFilePath) {
    try {
      const baseDir = (process.platform === "win32" && process.env.APPDATA)
        ? path.join(process.env.APPDATA, "Accounts360")
        : path.join(os.homedir(), ".accounts360");
      fs.mkdirSync(baseDir, { recursive: true });
      logFilePath = path.join(baseDir, "desktop.log");
    } catch {
      logFilePath = path.join(process.cwd(), "desktop.log");
    }
  }
  return logFilePath;
}

function log(...args) {
  const msg = `[${new Date().toISOString()}] ${args.join(" ")}\n`;
  try {
    process.stdout.write(msg);
  } catch {}
  try {
    fs.appendFileSync(getLogPath(), msg);
  } catch {}
}

log("==================================================");
log("Accounts360 Desktop Main Process Initializing...");
log(`App Path: ${app.getAppPath()}`);
log(`Exec Path: ${process.execPath}`);
log(`Resources Path: ${process.resourcesPath || "N/A"}`);
log(`Is Packaged: ${app.isPackaged}`);
log("==================================================");

// Prevent duplicate instances (Single-Instance Mutex Lock)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  log("Duplicate instance detected. Exiting.");
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
 * Checks if local HTTP server is alive and responding.
 */
function checkHttpReady(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}`, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Resolves the location of server.js depending on packaged vs development mode.
 */
function findServerScript() {
  const candidates = [];

  if (app.isPackaged) {
    // 1. Packaged extraResources: <install_dir>/resources/server/server.js
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, "server", "server.js"));
      candidates.push(path.join(process.resourcesPath, "app.asar.unpacked", "server", "server.js"));
    }
  }

  // 2. Local development standalone build
  candidates.push(path.resolve(__dirname, "..", ".next", "standalone", "server.js"));
  candidates.push(path.resolve(__dirname, "server", "server.js"));
  candidates.push(path.join(app.getAppPath(), "..", ".next", "standalone", "server.js"));

  for (const candidate of candidates) {
    log(`Checking server candidate: ${candidate}`);
    if (fs.existsSync(candidate)) {
      log(`✓ Server script matched: ${candidate}`);
      return candidate;
    }
  }

  return null;
}

/**
 * Starts the local Next.js standalone server if not already running.
 */
async function startLocalServer(port) {
  const alreadyRunning = await checkHttpReady(port);
  if (alreadyRunning) {
    log(`[DesktopMain] Server already responding on http://127.0.0.1:${port}.`);
    return true;
  }

  const serverScript = findServerScript();
  if (!serverScript) {
    log(`[DesktopMain] ERROR: Unable to locate server.js in any known directory.`);
    return false;
  }

  const serverCwd = path.dirname(serverScript);
  log(`[DesktopMain] Spawning embedded Next.js server...`);
  log(`[DesktopMain] Script: ${serverScript}`);
  log(`[DesktopMain] CWD: ${serverCwd}`);
  log(`[DesktopMain] Executable: ${process.execPath}`);

  serverProcess = spawn(process.execPath, [serverScript], {
    cwd: serverCwd,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      ACCOUNTS360_DESKTOP: "true",
      DESKTOP_MODE: "true",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  serverProcess.stdout.on("data", (chunk) => {
    log(`[Next.js stdout] ${chunk.toString().trim()}`);
  });

  serverProcess.stderr.on("data", (chunk) => {
    log(`[Next.js stderr] ${chunk.toString().trim()}`);
  });

  serverProcess.on("error", (err) => {
    log(`[Next.js process error] ${err.message}`);
  });

  serverProcess.on("close", (code) => {
    log(`[Next.js process exited] Code: ${code}`);
  });

  // Wait up to 30 seconds for HTTP ready
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const ready = await checkHttpReady(port);
    if (ready) {
      log(`[DesktopMain] Server responded to HTTP on port ${port} after ${(i + 1) * 0.5}s.`);
      return true;
    }
  }

  log(`[DesktopMain] WARNING: Server process did not respond on HTTP port ${port} within timeout.`);
  return false;
}

const SPLASH_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Accounts360</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
      user-select: none;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 40px 48px;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      max-width: 440px;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid #334155;
      border-top: 4px solid #38bdf8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 6px 0; letter-spacing: -0.02em; color: #ffffff; }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.3);
      padding: 2px 10px;
      border-radius: 9999px;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    p { color: #94a3b8; font-size: 14px; margin: 0 0 10px 0; }
    .urdu { font-family: "Segoe UI", Tahoma, sans-serif; font-size: 13px; color: #64748b; direction: rtl; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <h1>Accounts360</h1>
    <div class="badge">Standalone Offline Suite</div>
    <p>Starting local accounting engine...</p>
    <div class="urdu">لوکل اکاؤنٹنگ انجن شروع ہو رہا ہے، براہ کرم انتظار کیجیے...</div>
  </div>
</body>
</html>`)}`;

function createMainWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#0f172a",
    show: false,
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

  // Show splash immediately so user never sees a blank white window
  mainWindow.loadURL(SPLASH_HTML);
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const appUrl = `http://127.0.0.1:${port}`;

  const tryLoadApp = async () => {
    const ready = await checkHttpReady(port);
    if (ready && mainWindow) {
      log(`[DesktopMain] Loading application URL: ${appUrl}`);
      mainWindow.loadURL(appUrl);
    } else {
      log(`[DesktopMain] Waiting for server on port ${port}...`);
      setTimeout(tryLoadApp, 1000);
    }
  };

  tryLoadApp();

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    log(`[DesktopMain] did-fail-load: ${errorCode} - ${errorDescription}`);
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.loadURL(appUrl);
      }
    }, 1500);
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" || (input.control && input.shift && input.key.toLowerCase() === "i")) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * Deterministic Native Hardware ID generator (self-contained)
 */
function getNativeMachineId() {
  try {
    let raw = "";
    if (process.platform === "win32") {
      try {
        const cmd = "(Get-CimInstance Win32_ComputerSystemProduct).UUID; (Get-CimInstance Win32_BaseBoard).SerialNumber; (Get-CimInstance Win32_Processor).ProcessorId";
        raw = execSync(`powershell -NoProfile -NonInteractive -Command "${cmd}"`, {
          timeout: 4000,
          encoding: "utf8",
          windowsHide: true,
        }).replace(/\r/g, "").trim();
      } catch {
        try {
          raw = execSync("wmic csproduct get uuid", { timeout: 3000, encoding: "utf8", windowsHide: true })
            .replace(/UUID|\r|\n|\s/gi, "").trim();
        } catch {}
      }
    }

    if (!raw) {
      const os = require("os");
      raw = `${os.hostname()}:${os.arch()}:${os.cpus()?.[0]?.model || ""}`;
    }

    const hash = crypto.createHash("sha256").update(raw.trim()).digest("hex").toUpperCase();
    return `MCH-${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}`;
  } catch (err) {
    log(`[DesktopMain] Machine ID generation fallback: ${err.message}`);
    return "MCH-0000-0000-0000";
  }
}

// IPC Handlers
ipcMain.handle("get-machine-id", async () => {
  return getNativeMachineId();
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
  createMainWindow(port);
  await startLocalServer(port);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(port);
    }
  });
});

app.on("window-all-closed", () => {
  log("All windows closed. Cleaning up server process...");
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {}
    serverProcess = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {}
    serverProcess = null;
  }
});
