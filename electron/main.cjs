const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    title: '3amory phone - Mobile POS Pro',
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
    mainWindow.show();
  });

  // Load from local Vite dev server if running, or from dist/index.html
  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
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

  // Printer IPC Handlers
  ipcMain.handle('printer:get-printers', async () => {
    try {
      if (mainWindow) {
        return await mainWindow.webContents.getPrintersAsync();
      }
      return [];
    } catch (err) {
      console.error('Error fetching printers in Electron:', err);
      return [];
    }
  });

  ipcMain.handle('printer:print-silent', async (event, options = {}) => {
    return new Promise((resolve) => {
      if (!mainWindow) return resolve(false);

      mainWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: options.deviceName || '',
          margins: { marginType: 'none' },
        },
        (success, errorType) => {
          if (!success) {
            console.warn('Silent print error:', errorType);
          }
          resolve(success);
        }
      );
    });
  });

  ipcMain.handle('printer:print-raw', async (event, data) => {
    // Handled via silent webContents printing or direct device pipe
    return true;
  });

  ipcMain.handle('printer:kick-drawer', async () => {
    // ESC/POS drawer kick command
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
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
