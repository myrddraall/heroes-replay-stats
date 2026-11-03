"use strict";

// src/preload.ts
var import_electron = require("electron");

// src/bridge.ts
var CHANNELS = {
  pickReplays: "hrs:pick-replays",
  defaultReplayDirectory: "hrs:default-replay-directory"
};

// src/preload.ts
import_electron.contextBridge.exposeInMainWorld("heroesDesktop", {
  version: process.env["npm_package_version"] ?? "0.0.0-MAIN",
  pickReplays: () => import_electron.ipcRenderer.invoke(CHANNELS.pickReplays),
  defaultReplayDirectory: () => import_electron.ipcRenderer.invoke(CHANNELS.defaultReplayDirectory)
});
//# sourceMappingURL=preload.js.map