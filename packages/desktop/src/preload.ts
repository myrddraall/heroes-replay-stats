import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS, type PickedReplayFile } from './bridge';

// `window.heroesDesktop` — the app's `providePlatform()` picks the desktop platform when it exists.
contextBridge.exposeInMainWorld('heroesDesktop', {
  version: process.env['npm_package_version'] ?? '0.0.0-MAIN',
  pickReplays: (): Promise<PickedReplayFile[]> => ipcRenderer.invoke(CHANNELS.pickReplays),
  defaultReplayDirectory: (): Promise<string | undefined> =>
    ipcRenderer.invoke(CHANNELS.defaultReplayDirectory),
});
