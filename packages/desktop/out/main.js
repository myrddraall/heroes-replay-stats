"use strict";

// src/main.ts
var import_electron = require("electron");
var import_promises = require("fs/promises");
var import_node_fs = require("fs");
var import_node_path = require("path");

// src/bridge.ts
var CHANNELS = {
  pickReplays: "hrs:pick-replays",
  defaultReplayDirectory: "hrs:default-replay-directory"
};

// src/main.ts
var isDev = process.argv.includes("--dev");
var DEV_URL = process.env["HRS_DEV_URL"] ?? "http://localhost:4200";
function defaultReplayDirectory() {
  const home = import_electron.app.getPath("home");
  const candidates = process.platform === "win32" ? [(0, import_node_path.join)(import_electron.app.getPath("documents"), "Heroes of the Storm", "Accounts")] : process.platform === "darwin" ? [
    (0, import_node_path.join)(
      home,
      "Library",
      "Application Support",
      "Blizzard",
      "Heroes of the Storm",
      "Accounts"
    )
  ] : [(0, import_node_path.join)(home, "Heroes of the Storm", "Accounts")];
  return candidates.find((c) => (0, import_node_fs.existsSync)(c));
}
async function pickReplays(win) {
  const defaultPath = defaultReplayDirectory();
  const result = await import_electron.dialog.showOpenDialog(win, {
    title: "Choose replays",
    ...defaultPath !== void 0 ? { defaultPath } : {},
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "Heroes of the Storm replays", extensions: ["StormReplay", "StormR"] }]
  });
  if (result.canceled) return [];
  return Promise.all(
    result.filePaths.map(async (path) => ({
      name: (0, import_node_path.basename)(path),
      path,
      bytes: new Uint8Array(await (0, import_promises.readFile)(path))
    }))
  );
}
function createWindow() {
  const win = new import_electron.BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#070b16",
    title: "Heroes Replay Stats",
    webPreferences: {
      preload: (0, import_node_path.join)(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    void import_electron.shell.openExternal(url);
    return { action: "deny" };
  });
  if (isDev) {
    void win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    void win.loadFile((0, import_node_path.join)(__dirname, "..", "app", "index.html"));
  }
  return win;
}
import_electron.app.whenReady().then(() => {
  const win = createWindow();
  import_electron.ipcMain.handle(CHANNELS.pickReplays, () => pickReplays(win));
  import_electron.ipcMain.handle(CHANNELS.defaultReplayDirectory, () => defaultReplayDirectory());
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
//# sourceMappingURL=main.js.map