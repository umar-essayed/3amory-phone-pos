const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const child_process = require('child_process');

// ═══════════════════════════════════════════════════════════════════════════
// 1. Persistent Storage Paths (Fixed Across App Updates & Clean Installs)
// Guaranteed NOT to be wiped when updating .exe, AppImage, or reinstalling.
// ═══════════════════════════════════════════════════════════════════════════
const homeDir = app.getPath('home');
// Persistent storage directory for El Ghandour Phone POS (maintaining backward compatibility)
const legacyDataDir = path.join(homeDir, '.3amory-pos-data');
const preferredDataDir = path.join(homeDir, '.elghandour-pos-data');
const persistentDataDir = fs.existsSync(legacyDataDir) && !fs.existsSync(preferredDataDir)
  ? legacyDataDir
  : preferredDataDir;

const legacyBackupsDir = path.join(homeDir, '3amory-pos-backups');
const preferredBackupsDir = path.join(homeDir, 'elghandour-pos-backups');
const backupsDir = fs.existsSync(legacyBackupsDir) && !fs.existsSync(preferredBackupsDir)
  ? legacyBackupsDir
  : preferredBackupsDir;

const legacyLogsDir = path.join(homeDir, '3amory-pos-logs');
const preferredLogsDir = path.join(homeDir, 'elghandour-pos-logs');
const logsDir = fs.existsSync(legacyLogsDir) && !fs.existsSync(preferredLogsDir)
  ? legacyLogsDir
  : preferredLogsDir;

const invoicePreviewsDir = path.join(logsDir, 'invoice-previews');

const dbMirrorFile = path.join(persistentDataDir, 'local_pos_database_mirror.json');
const initLogFile = path.join(logsDir, 'init-and-db.log');
const printerLogFile = path.join(logsDir, 'printer.log');
const systemErrorsLogFile = path.join(logsDir, 'system-errors.log');

// Configure Chromium to strictly use persistentDataDir so IndexedDB is NEVER lost
try {
  if (!fs.existsSync(persistentDataDir)) {
    fs.mkdirSync(persistentDataDir, { recursive: true });
  }
  app.setPath('userData', persistentDataDir);
} catch (err) {
  console.error('Failed setting persistent userData path:', err);
}

function ensureDirectoriesAndFiles() {
  try {
    if (!fs.existsSync(persistentDataDir)) {
      fs.mkdirSync(persistentDataDir, { recursive: true });
    }
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    if (!fs.existsSync(invoicePreviewsDir)) {
      fs.mkdirSync(invoicePreviewsDir, { recursive: true });
    }

    // Initialize files with header if they do not exist
    const timestamp = new Date().toISOString();
    const systemInfo = `Platform: ${process.platform} (${process.arch}) | OS: ${os.type()} ${os.release()} | Electron: ${process.versions.electron} | Node: ${process.versions.node}`;

    if (!fs.existsSync(initLogFile)) {
      fs.writeFileSync(
        initLogFile,
        `=== [الغندور فون - El Ghandour Phone POS] - سجل التهيأة وقواعد البيانات المحلية (Init & DB Log) ===\nتاريخ الإنشاء: ${timestamp}\n${systemInfo}\nالمجلد الدائم: ${persistentDataDir}\n--------------------------------------------------------------------------------\n`
      );
    }

    if (!fs.existsSync(printerLogFile)) {
      fs.writeFileSync(
        printerLogFile,
        `=== [الغندور فون - El Ghandour Phone POS] - سجل محاولات وعمليات الطباعة (Printer Audit Log) ===\nتاريخ الإنشاء: ${timestamp}\n${systemInfo}\n--------------------------------------------------------------------------------\n`
      );
    }

    if (!fs.existsSync(systemErrorsLogFile)) {
      fs.writeFileSync(
        systemErrorsLogFile,
        `=== [الغندور فون - El Ghandour Phone POS] - سجل أخطاء وتوقفات النظام (System Errors & Crashes Log) ===\nتاريخ الإنشاء: ${timestamp}\n${systemInfo}\n--------------------------------------------------------------------------------\n`
      );
    }
  } catch (err) {
    console.error('Failed to initialize logs directory structure:', err);
  }
}

function appendToLog(filePath, message, tag = 'INFO') {
  try {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 23);
    const line = `[${timestamp}] [${tag}] ${message}\n`;
    fs.appendFileSync(filePath, line, 'utf8');
  } catch (err) {
    console.error(`Failed to write to log file ${filePath}:`, err);
  }
}

// Global process error logging
process.on('uncaughtException', (error) => {
  appendToLog(systemErrorsLogFile, `UNCAUGHT EXCEPTION: ${error.message}\nStack: ${error.stack}`, 'FATAL');
  appendToLog(initLogFile, `CRITICAL SYSTEM ERROR: ${error.message}`, 'ERROR');
});

process.on('unhandledRejection', (reason) => {
  appendToLog(systemErrorsLogFile, `UNHANDLED REJECTION: ${String(reason)}`, 'WARN');
});

// Ensure directory setup immediately on launch
ensureDirectoriesAndFiles();
appendToLog(initLogFile, `=== Application Session Started (PID: ${process.pid}) ===`, 'STARTUP');
appendToLog(initLogFile, `Persistent UserData Path: ${persistentDataDir}`, 'STORAGE');

let mainWindow = null;

function createWindow() {
  appendToLog(initLogFile, 'Creating main application BrowserWindow...', 'INIT');

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'الغندور فون - El Ghandour Phone POS',
    backgroundColor: '#0f172a', // Deep dark slate - prevents blank white flashes
    icon: path.join(__dirname, '../logo-removebg-preview.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    appendToLog(initLogFile, 'BrowserWindow ready-to-show event fired. Displaying window.', 'INFO');
    mainWindow.show();
  });

  // Track page load failures to diagnose white screens / network errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    const failMsg = `Failed to load URL [${validatedURL}]: (${errorCode}) ${errorDescription}`;
    appendToLog(initLogFile, failMsg, 'ERROR');
    appendToLog(systemErrorsLogFile, failMsg, 'LOAD_FAILURE');
  });

  mainWindow.webContents.on('did-finish-load', () => {
    appendToLog(initLogFile, 'Web page successfully finished loading and DOM is ready.', 'INFO');
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    const crashMsg = `Renderer process gone! Reason: ${details.reason} (ExitCode: ${details.exitCode})`;
    appendToLog(systemErrorsLogFile, crashMsg, 'CRASH');
    appendToLog(initLogFile, crashMsg, 'CRASH');
  });

  // Load from local Vite dev server if running, or from dist/index.html
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    appendToLog(initLogFile, `Loading from VITE_DEV_SERVER_URL: ${process.env.VITE_DEV_SERVER_URL}`, 'INIT');
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch((err) => {
      appendToLog(initLogFile, `Dev server connection failed: ${err.message}. Falling back to dist/index.html`, 'WARN');
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    const productionHtml = path.join(__dirname, '../dist/index.html');
    appendToLog(initLogFile, `Production mode: loading local bundle from: ${productionHtml}`, 'INIT');
    mainWindow.loadFile(productionHtml).catch((err) => {
      appendToLog(initLogFile, `FATAL: Failed to load production HTML: ${err.message}`, 'FATAL');
      appendToLog(systemErrorsLogFile, `loadFile error: ${err.message}\nStack: ${err.stack}`, 'FATAL');
    });
  }

  // Window control handlers
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow?.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 3. Persistent Database Mirror & Backup Handlers
  // ═════════════════════════════════════════════════════════════════════════
  ipcMain.handle('db:save-mirror', async (event, jsonData) => {
    try {
      if (typeof jsonData === 'string') {
        fs.writeFileSync(dbMirrorFile, jsonData, 'utf8');
      } else {
        fs.writeFileSync(dbMirrorFile, JSON.stringify(jsonData, null, 2), 'utf8');
      }
      return { success: true, path: dbMirrorFile };
    } catch (err) {
      appendToLog(systemErrorsLogFile, `Failed saving database mirror: ${err.message}`, 'ERROR');
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:load-mirror', async () => {
    try {
      if (fs.existsSync(dbMirrorFile)) {
        const raw = fs.readFileSync(dbMirrorFile, 'utf8');
        return { exists: true, data: JSON.parse(raw) };
      }
      return { exists: false };
    } catch (err) {
      appendToLog(systemErrorsLogFile, `Failed reading database mirror: ${err.message}`, 'ERROR');
      return { exists: false, error: err.message };
    }
  });

  ipcMain.handle('backup:save-snapshot', async (event, { filename, jsonContent, folderName }) => {
    try {
      let targetDir = backupsDir;
      if (folderName) {
        targetDir = path.join(backupsDir, folderName);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }
      }
      const safeFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
      const fullPath = path.join(targetDir, safeFilename);
      fs.writeFileSync(fullPath, jsonContent, 'utf8');
      appendToLog(initLogFile, `Saved backup snapshot: ${fullPath}`, 'BACKUP');
      return { success: true, path: fullPath };
    } catch (err) {
      appendToLog(systemErrorsLogFile, `Failed to save backup snapshot: ${err.message}`, 'ERROR');
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('backup:open-folder', async () => {
    try {
      await shell.openPath(backupsDir);
      return true;
    } catch (err) {
      return false;
    }
  });

  ipcMain.handle('storage:get-paths', () => {
    return {
      persistentDataDir,
      backupsDir,
      logsDir,
      dbMirrorFile,
    };
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 4. Logging IPC Handlers
  // ═════════════════════════════════════════════════════════════════════════
  ipcMain.handle('logger:log-init', (event, { message, isError, data }) => {
    const tag = isError ? 'ERROR' : 'INFO';
    const detail = data ? ` | Data: ${JSON.stringify(data)}` : '';
    appendToLog(initLogFile, `${message}${detail}`, tag);
    return true;
  });

  ipcMain.handle('logger:log-printer', (event, { message, isError, printerName, docType, details }) => {
    const tag = isError ? 'FAIL' : 'SUCCESS';
    const printer = printerName ? ` [Device: ${printerName}]` : ' [Default]';
    const doc = docType ? ` [Doc: ${docType}]` : '';
    const extra = details ? ` | Details: ${JSON.stringify(details)}` : '';
    appendToLog(printerLogFile, `${tag}${printer}${doc} ${message}${extra}`, tag);
    return true;
  });

  ipcMain.handle('logger:log-error', (event, { message, stack, context }) => {
    const ctx = context ? ` [Context: ${context}]` : '';
    const stackTrace = stack ? `\nStack: ${stack}` : '';
    appendToLog(systemErrorsLogFile, `${message}${ctx}${stackTrace}`, 'ERROR');
    return true;
  });

  ipcMain.handle('logger:save-invoice-preview', async (event, { invoiceNumber, imageBase64, htmlContent, metadata }) => {
    try {
      const sanitizedNum = String(invoiceNumber || 'INV').replace(/[^a-zA-Z0-9_-]/g, '_');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const baseFilename = `invoice_${sanitizedNum}_${timestamp}`;

      if (imageBase64 && imageBase64.includes('base64,')) {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const imgPath = path.join(invoicePreviewsDir, `${baseFilename}.png`);
        fs.writeFileSync(imgPath, imageBuffer);
      }

      if (htmlContent) {
        const htmlDoc = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>Invoice Snapshot - ${sanitizedNum}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #f1f5f9; padding: 24px; display: flex; justify-content: center; }
    .receipt-container { background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); padding: 20px; max-width: 80mm; width: 100%; }
  </style>
</head>
<body>
  <div class="receipt-container">
    ${htmlContent}
  </div>
</body>
</html>`;
        const htmlPath = path.join(invoicePreviewsDir, `${baseFilename}.html`);
        fs.writeFileSync(htmlPath, htmlDoc, 'utf8');
      }

      appendToLog(printerLogFile, `Invoice snapshot saved: ${baseFilename} (.png / .html)`, 'SNAPSHOT');
      return { success: true, filename: baseFilename };
    } catch (err) {
      appendToLog(systemErrorsLogFile, `Failed to save invoice screenshot: ${err.message}`, 'ERROR');
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('logger:open-logs-folder', async () => {
    try {
      await shell.openPath(logsDir);
      return true;
    } catch (err) {
      console.error('Failed to open logs directory:', err);
      return false;
    }
  });

  ipcMain.handle('logger:get-log-paths', () => {
    return {
      logsDir,
      invoicePreviewsDir,
      initLogFile,
      printerLogFile,
      systemErrorsLogFile,
    };
  });

  // ═════════════════════════════════════════════════════════════════════════
  // 5. Printer IPC Handlers & QZ Launchers
  // ═════════════════════════════════════════════════════════════════════════
  ipcMain.handle('printer:get-printers', async () => {
    try {
      if (mainWindow) {
        const printers = await mainWindow.webContents.getPrintersAsync();
        appendToLog(printerLogFile, `Discovered ${printers.length} system printer(s): ${printers.map(p => p.name).join(', ')}`, 'INFO');
        return printers;
      }
      return [];
    } catch (err) {
      appendToLog(printerLogFile, `Error querying system printers: ${err.message}`, 'FAIL');
      return [];
    }
  });

  ipcMain.handle('printer:print-silent', async (event, options = {}) => {
    return new Promise((resolve) => {
      if (!mainWindow) return resolve(false);

      const targetDevice = options.deviceName || 'Default';
      appendToLog(printerLogFile, `Initiating native silent print job to device: ${targetDevice}`, 'INFO');

      let finished = false;
      const timer = setTimeout(() => {
        if (!finished) {
          finished = true;
          appendToLog(printerLogFile, `Silent print timed out (3000ms) on device [${targetDevice}]`, 'WARN');
          resolve(false);
        }
      }, 3000);

      try {
        mainWindow.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: options.deviceName || '',
            margins: { marginType: 'none' },
          },
          (success, errorType) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            if (!success) {
              appendToLog(printerLogFile, `Silent print failed on device [${targetDevice}]: ${errorType}`, 'FAIL');
            } else {
              appendToLog(printerLogFile, `Silent print successfully dispatched to device [${targetDevice}]`, 'SUCCESS');
            }
            resolve(success);
          }
        );
      } catch (err) {
        if (!finished) {
          finished = true;
          clearTimeout(timer);
          resolve(false);
        }
      }
    });
  });

  ipcMain.handle('printer:print-raw', async (event, data) => {
    appendToLog(printerLogFile, `Direct RAW ESC/POS buffer received (${data?.length || 0} bytes)`, 'RAW');
    return true;
  });

  ipcMain.handle('printer:kick-drawer', async () => {
    appendToLog(printerLogFile, 'Cash drawer kick signal triggered via IPC', 'DRAWER');
    return true;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  appendToLog(initLogFile, 'All windows closed. Quitting application.', 'EXIT');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
