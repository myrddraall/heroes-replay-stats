import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { CHANNELS, type PickedReplayFile } from './bridge';

const isDev = process.argv.includes('--dev');
const DEV_URL = process.env['HRS_DEV_URL'] ?? 'http://localhost:4200';

/** Where the Heroes of the Storm client writes replays, per platform, if it exists. */
function defaultReplayDirectory(): string | undefined {
  const home = app.getPath('home');
  const candidates =
    process.platform === 'win32'
      ? [join(app.getPath('documents'), 'Heroes of the Storm', 'Accounts')]
      : process.platform === 'darwin'
        ? [
            join(
              home,
              'Library',
              'Application Support',
              'Blizzard',
              'Heroes of the Storm',
              'Accounts',
            ),
          ]
        : [join(home, 'Heroes of the Storm', 'Accounts')];
  return candidates.find((c) => existsSync(c));
}

async function pickReplays(win: BrowserWindow): Promise<PickedReplayFile[]> {
  const defaultPath = defaultReplayDirectory();
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose replays',
    ...(defaultPath !== undefined ? { defaultPath } : {}),
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Heroes of the Storm replays', extensions: ['StormReplay', 'StormR'] }],
  });
  if (result.canceled) return [];
  return Promise.all(
    result.filePaths.map(async (path) => ({
      name: basename(path),
      path,
      bytes: new Uint8Array(await readFile(path)),
    })),
  );
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#070b16',
    title: 'Heroes Replay Stats',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  // External links open in the system browser, never inside the shell.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  if (isDev) {
    void win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    void win.loadFile(join(__dirname, '..', 'app', 'index.html'));
  }
  return win;
}

app.whenReady().then(() => {
  const win = createWindow();
  ipcMain.handle(CHANNELS.pickReplays, () => pickReplays(win));
  ipcMain.handle(CHANNELS.defaultReplayDirectory, () => defaultReplayDirectory());
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
