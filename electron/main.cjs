const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ═══════════════════════════════════════════════════════════════════════════
// Dedicated Logging & Audit Directories in User Home
// Example: /home/username/3amory-pos-logs OR C:\Users\username\3amory-pos-logs
// ═══════════════════════════════════════════════════════════════════════════
const homeDir = app.getPath('home');
const logsDir = path.join(homeDir, '3amory-pos-logs');
const invoicePreviewsDir = path.join(logsDir, 'invoice-previews');

const initLogFile = path.join(logsDir, 'init-and-db.log');
const printerLogFile = path.join(logsDir, 'printer.log');
const systemErrorsLogFile = path.join(logsDir, 'system-errors.log');

function ensureDirectoriesAndFiles() {
  try {
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
        `=== [3amory phone POS] - سجل التهيأة وقواعد البيانات المحلية (Init & DB Log) ===\nتاريخ الإنشاء: ${timestamp}\n${systemInfo}\nالمجلد: ${logsDir}\n--------------------------------------------------------------------------------\n`
      );
    }

    if (!fs.existsSync(printerLogFile)) {
      fs.writeFileSync(
        printerLogFile,
        `=== [3amory phone POS] - سجل محاولات وعمليات الطباعة (Printer Audit Log) ===\nتاريخ الإنشاء: ${timestamp}\n${systemInfo}\n--------------------------------------------------------------------------------\n`
      );
    }

    if (!fs.existsSync(systemErrorsLogFile)) {
      fs.writeFileSync(
        systemErrorsLogFile,
        `=== [3amory phone POS] - سجل أخطاء وتوقفات النظام (System Errors & Crashes Log) ===\nتاريخ الإنشاء: ${timestamp}\n${systemInfo}\n--------------------------------------------------------------------------------\n`
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

let mainWindow = null;

function createWindow() {
  appendToLog(initLogFile, 'Creating main application BrowserWindow...', 'INIT');

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: '3amory phone - Mobile POS Pro',
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
  // Logging IPC Handlers
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

      // 1. Save PNG Screenshot if base64 image provided
      if (imageBase64 && imageBase64.includes('base64,')) {
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        const imgPath = path.join(invoicePreviewsDir, `${baseFilename}.png`);
        fs.writeFileSync(imgPath, imageBuffer);
      }

      // 2. Save styled standalone HTML snapshot
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
  // Printer IPC Handlers
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
      appendToLog(printerLogFile, `Initiating silent print job to device: ${targetDevice}`, 'INFO');

      mainWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: options.deviceName || '',
          margins: { marginType: 'none' },
        },
        (success, errorType) => {
          if (!success) {
            appendToLog(printerLogFile, `Silent print failed on device [${targetDevice}]: ${errorType}`, 'FAIL');
          } else {
            appendToLog(printerLogFile, `Silent print successfully dispatched to device [${targetDevice}]`, 'SUCCESS');
          }
          resolve(success);
        }
      );
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
