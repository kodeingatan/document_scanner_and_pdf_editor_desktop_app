import { BrowserWindow, Menu, app, nativeTheme, session, shell } from 'electron';
import path from 'node:path';
import { paths } from './lib/paths';
import { logger } from './lib/logger';
import { db } from './services/database';
import { settings } from './services/settings';
import { office } from './services/office';
import { registerIpc, shouldAllowClose } from './ipc';
import { jobs } from './lib/jobs';

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
let mainWindow: BrowserWindow | null = null;
let autoSaveTimer: NodeJS.Timeout | null = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function menuTemplate(): Electron.MenuItemConstructorOptions[] {
  const send = (action: string) => () => mainWindow?.webContents.send('app:menu-action', action);
  return [
    {
      label: 'File',
      submenu: [
        { label: 'Dokumen Baru', accelerator: 'CmdOrCtrl+N', click: send('new') },
        { label: 'Buka Dokumen', accelerator: 'CmdOrCtrl+O', click: send('open') },
        { label: 'Impor File', accelerator: 'CmdOrCtrl+I', click: send('import') },
        { type: 'separator' },
        { label: 'Simpan', accelerator: 'CmdOrCtrl+S', click: send('save') },
        { label: 'Simpan Sebagai', accelerator: 'CmdOrCtrl+Shift+S', click: send('save-as') },
        { label: 'Ekspor PDF', accelerator: 'CmdOrCtrl+E', click: send('export') },
        { type: 'separator' },
        { label: 'Cetak', accelerator: 'CmdOrCtrl+P', click: send('print') },
        { type: 'separator' },
        { role: 'quit', label: 'Keluar' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: send('undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: send('redo') },
        { label: 'Hapus Halaman', accelerator: 'Delete', click: send('delete-page') },
        { type: 'separator' },
        { label: 'Cari', accelerator: 'CmdOrCtrl+F', click: send('search') },
        { type: 'separator' },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: send('zoom-in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: send('zoom-out') },
        { label: 'Zoom Reset', accelerator: 'CmdOrCtrl+0', click: send('zoom-reset') },
      ],
    },
    {
      label: 'Tampilan',
      submenu: [
        { label: 'Home', accelerator: 'CmdOrCtrl+1', click: send('nav-home') },
        { label: 'Scanner', accelerator: 'CmdOrCtrl+2', click: send('nav-scanner') },
        { label: 'PDF Tools', accelerator: 'CmdOrCtrl+3', click: send('nav-pdf') },
        { label: 'Image Editor', accelerator: 'CmdOrCtrl+4', click: send('nav-editor') },
        { label: 'Library', accelerator: 'CmdOrCtrl+5', click: send('nav-library') },
        { label: 'OCR', accelerator: 'CmdOrCtrl+6', click: send('nav-ocr') },
        { type: 'separator' },
        { role: 'toggleDevTools', label: 'Developer Tools' },
        { role: 'reload' },
      ],
    },
    {
      label: 'Bantuan',
      submenu: [
        { label: 'Pengaturan', accelerator: 'CmdOrCtrl+,', click: send('nav-settings') },
        {
          label: 'Tentang Aplikasi',
          click: () => {
            mainWindow?.webContents.send('app:menu-action', 'about');
          },
        },
      ],
    },
  ];
}

function registerLocalFileProtocol(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'X-Content-Type-Options': ['nosniff'],
      },
    });
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['media', 'mediaKeySystem', 'clipboard-read'].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((_contents, permission) =>
    ['media', 'clipboard-read'].includes(permission),
  );
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b0b0c' : '#ffffff',
    title: 'Document Scanner & PDF Editor',
    icon: path.join(app.getAppPath(), 'resources', 'icon.png'),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev && process.env.VITE_DEV_SERVER_URL && url.startsWith(process.env.VITE_DEV_SERVER_URL);
    if (!allowed) event.preventDefault();
  });

  mainWindow.on('close', (event) => {
    if (!shouldAllowClose()) {
      event.preventDefault();
      mainWindow?.webContents.send('app:request-close');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function scheduleAutoSave(): void {
  if (autoSaveTimer) clearInterval(autoSaveTimer);
  const current = settings.get();
  if (!current.autoSave) return;
  autoSaveTimer = setInterval(() => {
    db.flush();
    if (current.backupEnabled) {
      const stamp = new Date();
      if (stamp.getMinutes() % 30 === 0) db.backup();
    }
  }, Math.max(15, current.autoSaveIntervalSec) * 1000);
}

async function bootstrap(): Promise<void> {
  await app.whenReady();
  await db.init();
  settings.load();
  nativeTheme.themeSource = settings.get().theme;
  paths.setDocumentsRoot(settings.documentsDirectory || null);
  registerLocalFileProtocol();
  registerIpc();
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate()));
  await createWindow();
  scheduleAutoSave();
  office.detect().catch(() => undefined);
  if (settings.get().tempAutoCleanup) {
    paths.cleanupTemp().then((removed) => logger.info('app', 'temp cleanup', { removed })).catch(() => undefined);
  }
  logger.info('app', 'started', { version: app.getVersion(), documents: settings.documentsDirectory });
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  jobs.cancelAll();
  db.flush();
  db.backup();
  db.close();
  logger.close();
});

process.on('uncaughtException', (error) => {
  logger.error('app', 'uncaught exception', { message: error.message, stack: error.stack?.slice(0, 2000) });
});

process.on('unhandledRejection', (reason) => {
  logger.error('app', 'unhandled rejection', { reason: String(reason) });
});

void bootstrap().catch((error) => {
  logger.error('app', 'bootstrap failed', { message: String(error) });
  app.quit();
});
